import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Note, NoteInput, PrayerItemInput } from '@pray/api-contract';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../src/app.setup.js';
import { AuthModule } from '../src/auth/auth.module.js';
import {
  DATABASE,
  type Database,
  DatabaseModule,
} from '../src/database/database.module.js';
import { notes, prayerItems } from '../src/database/schema.js';
import { loadLocalEnv } from '../src/env.js';
import { NotesModule } from '../src/notes/notes.module.js';
import { TagsModule } from '../src/tags/tags.module.js';

let app: INestApplication<App>;
let db: Database;

beforeAll(async () => {
  loadLocalEnv();
  const moduleRef = await Test.createTestingModule({
    imports: [
      DatabaseModule,
      AuthModule.register({ devLogin: true }),
      NotesModule,
      TagsModule,
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app, { devLogin: true });
  await app.init();
  db = app.get(DATABASE);
});

afterAll(async () => {
  await app.close();
});

/** 새 사용자로 로그인하고, 그 세션 쿠키로 요청하는 도우미를 돌려준다. */
async function newUser() {
  const response = await request(app.getHttpServer())
    .post('/auth/dev/login')
    .send({ displayName: `e2e-${randomUUID().slice(0, 8)}` })
    .expect(200);
  const raw = response.headers['set-cookie'] as unknown as string[];
  const cookie = raw
    .find((line) => line.startsWith('session='))!
    .split(';')[0]!;
  const server = app.getHttpServer();
  return {
    get: (path: string) => request(server).get(path).set('Cookie', cookie),
    put: (path: string, body: object) =>
      request(server).put(path).set('Cookie', cookie).send(body),
    delete: (path: string) =>
      request(server).delete(path).set('Cookie', cookie),
  };
}

function item(
  sortKey: string,
  title: string | null,
  overrides: Partial<PrayerItemInput> = {},
): PrayerItemInput {
  return {
    id: randomUUID(),
    sortKey,
    title,
    detail: null,
    tagIds: [],
    ...overrides,
  } as PrayerItemInput;
}

function noteInput(
  items: PrayerItemInput[],
  overrides: Partial<NoteInput> = {},
): NoteInput {
  return {
    prayedAt: '2026-10-23T07:10:00.000Z',
    memo: '요즘 마음이 지쳐 있다',
    tagIds: [],
    items,
    ...overrides,
  };
}

describe('노트 (e2e)', () => {
  it('로그인하지 않으면 401', async () => {
    await request(app.getHttpServer()).get('/notes').expect(401);
  });

  it('노트를 만들고 조회한다. 기도제목은 정렬 키 순서다', async () => {
    const user = await newUser();
    const id = randomUUID();
    const second = item('a1', '어머니 건강', { detail: '검사 결과가 다음 주' });
    const first = item('a0', '취업');
    const saved = await user
      .put(`/notes/${id}`, noteInput([second, first]))
      .expect(200);
    const note = saved.body as Note;
    expect(note).toMatchObject({
      id,
      memo: '요즘 마음이 지쳐 있다',
      version: 1,
    });
    expect(note.items.map((it) => it.title)).toEqual(['취업', '어머니 건강']);

    const fetched = await user.get(`/notes/${id}`).expect(200);
    expect(fetched.body).toEqual(note);
    const list = await user.get('/notes').expect(200);
    expect(list.body.notes.map((n: Note) => n.id)).toEqual([id]);
  });

  it('통째로 저장: 바뀐 레코드만 버전이 오르고, 빠진 기도제목은 삭제 표시된다', async () => {
    const user = await newUser();
    const id = randomUUID();
    const keep = item('a0', '취업');
    const change = item('a1', '이사');
    const remove = item('a2', '건강');
    await user
      .put(`/notes/${id}`, noteInput([keep, change, remove]))
      .expect(200);

    const [before] = await db
      .select()
      .from(prayerItems)
      .where(eq(prayerItems.id, keep.id));
    const updated = await user
      .put(
        `/notes/${id}`,
        noteInput([keep, { ...change, title: '이사 준비', sortKey: 'Zz' }]),
      )
      .expect(200);
    const note = updated.body as Note;
    // 'Zz'는 바이트 순서로 'a0'보다 앞이다
    expect(note.items.map((it) => it.title)).toEqual(['이사 준비', '취업']);
    expect(note.version).toBe(1); // 노트 자체는 바뀌지 않았다
    const versions = Object.fromEntries(
      note.items.map((it) => [it.id, it.version]),
    );
    expect(versions[keep.id]).toBe(1);
    expect(versions[change.id]).toBe(2);

    const [removed] = await db
      .select()
      .from(prayerItems)
      .where(eq(prayerItems.id, remove.id));
    expect(removed!.deletedAt).not.toBeNull();
    expect(removed!.changeSeq).toBeGreaterThan(before!.changeSeq);
  });

  it('같은 요청을 다시 보내도 결과가 같다(멱등)', async () => {
    const user = await newUser();
    const id = randomUUID();
    const body = noteInput([item('a0', '취업')]);
    const first = await user.put(`/notes/${id}`, body).expect(200);
    const second = await user.put(`/notes/${id}`, body).expect(200);
    expect(second.body).toEqual(first.body);
  });

  it('제목과 상세가 모두 비면 400', async () => {
    const user = await newUser();
    const response = await user
      .put(
        `/notes/${randomUUID()}`,
        noteInput([item('a0', null, { detail: '   ' })]),
      )
      .expect(400);
    expect(response.body.status).toBe(400);
  });

  it('다른 사람의 노트는 보이지도, 바꿀 수도, 지울 수도 없다(404)', async () => {
    const owner = await newUser();
    const other = await newUser();
    const id = randomUUID();
    await owner
      .put(`/notes/${id}`, noteInput([item('a0', '취업')]))
      .expect(200);
    await other.get(`/notes/${id}`).expect(404);
    await other
      .put(`/notes/${id}`, noteInput([item('a0', '가로채기')]))
      .expect(404);
    await other.delete(`/notes/${id}`).expect(404);
    expect(
      (await owner.get(`/notes/${id}`).expect(200)).body.items[0].title,
    ).toBe('취업');
  });

  it('다른 노트의 기도제목 ID를 보내면 409', async () => {
    const user = await newUser();
    const shared = item('a0', '취업');
    await user.put(`/notes/${randomUUID()}`, noteInput([shared])).expect(200);
    await user.put(`/notes/${randomUUID()}`, noteInput([shared])).expect(409);
  });

  it('지운 노트는 보이지 않고, 같은 ID로 다시 저장하면 되살아난다', async () => {
    const user = await newUser();
    const id = randomUUID();
    const body = noteInput([item('a0', '취업')]);
    const created = await user.put(`/notes/${id}`, body).expect(200);
    expect(created.body.version).toBe(1);
    await user.delete(`/notes/${id}`).expect(204);
    await user.delete(`/notes/${id}`).expect(204); // 이미 지웠어도 204, 버전은 그대로
    await user.get(`/notes/${id}`).expect(404);
    expect((await user.get('/notes').expect(200)).body.notes).toEqual([]);
    const [deleted] = await db.select().from(notes).where(eq(notes.id, id));
    // 삭제 표시도 다른 기기에 동기화할 변경이라 버전이 오른다
    expect(deleted!.version).toBe(2);
    expect(deleted!.deletedAt).not.toBeNull();

    const revived = await user.put(`/notes/${id}`, body).expect(200);
    expect(revived.body.items).toHaveLength(1);
    expect(revived.body.version).toBe(3);
  });

  it('목록은 기도한 시각의 역순이고 커서로 나눠 받는다', async () => {
    const user = await newUser();
    const at = (day: number) =>
      `2026-10-${String(day).padStart(2, '0')}T07:00:00.000Z`;
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [index, id] of ids.entries()) {
      await user
        .put(
          `/notes/${id}`,
          noteInput([item('a0', `${index}`)], { prayedAt: at(index + 1) }),
        )
        .expect(200);
    }
    const first = await user.get('/notes?limit=2').expect(200);
    expect(first.body.notes.map((n: Note) => n.id)).toEqual([ids[2], ids[1]]);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await user
      .get(`/notes?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .expect(200);
    expect(second.body.notes.map((n: Note) => n.id)).toEqual([ids[0]]);
    expect(second.body.nextCursor).toBeNull();
  });
});

describe('태그 (e2e)', () => {
  it('만들고, 이름이 겹치면 409, 알 수 없는 태그는 400, 지운 태그는 노트에서 빠진다', async () => {
    const user = await newUser();
    const health = randomUUID();
    const family = randomUUID();
    await user.put(`/tags/${health}`, { name: '건강' }).expect(200);
    await user.put(`/tags/${family}`, { name: '가족' }).expect(200);
    await user.put(`/tags/${randomUUID()}`, { name: '건강' }).expect(409);

    const list = await user.get('/tags').expect(200);
    expect(list.body.tags.map((t: { name: string }) => t.name)).toEqual([
      '가족',
      '건강',
    ]);

    await user
      .put(
        `/notes/${randomUUID()}`,
        noteInput([item('a0', '취업')], { tagIds: [randomUUID()] }),
      )
      .expect(400);

    const noteId = randomUUID();
    await user
      .put(
        `/notes/${noteId}`,
        noteInput([item('a0', '어머니 건강', { tagIds: [health] })], {
          tagIds: [family],
        }),
      )
      .expect(200);

    await user.put(`/tags/${health}`, { name: '건강과 회복' }).expect(200);
    await user.delete(`/tags/${family}`).expect(204);

    const note = (await user.get(`/notes/${noteId}`).expect(200)).body as Note;
    expect(note.tagIds).toEqual([]);
    expect(note.items[0]!.tagIds).toEqual([health]);
  });

  it('다른 사람의 태그는 바꿀 수 없다(404)', async () => {
    const owner = await newUser();
    const other = await newUser();
    const id = randomUUID();
    await owner.put(`/tags/${id}`, { name: '건강' }).expect(200);
    await other.put(`/tags/${id}`, { name: '가로채기' }).expect(404);
    await other.delete(`/tags/${id}`).expect(404);
  });
});
