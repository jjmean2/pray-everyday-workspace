import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../src/app.setup.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { hashSessionToken } from '../src/auth/session-policy.js';
import {
  DATABASE,
  type Database,
  DatabaseModule,
} from '../src/database/database.module.js';
import { sessions } from '../src/database/schema.js';
import { loadLocalEnv } from '../src/env.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function createApp(devLogin: boolean): Promise<INestApplication<App>> {
  loadLocalEnv();
  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseModule, AuthModule.register({ devLogin })],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

/** Set-Cookie에서 세션 쿠키 한 줄과 토큰을 꺼낸다. */
function sessionCookie(response: request.Response): {
  header: string;
  token: string;
} {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  const header = raw?.find((line) => line.startsWith('session='));
  if (header === undefined) {
    throw new Error('세션 쿠키가 없다');
  }
  const token = decodeURIComponent(
    header.split(';')[0]!.slice('session='.length),
  );
  return { header, token };
}

describe('인증 (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;

  beforeAll(async () => {
    app = await createApp(true);
    db = app.get(DATABASE);
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueName = () => `e2e-${randomUUID().slice(0, 8)}`;

  async function login(displayName: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ displayName })
      .expect(200);
    return { response, ...sessionCookie(response) };
  }

  it('로그인하지 않으면 /auth/me는 Problem Details로 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);
    expect(response.headers['content-type']).toMatch(
      /^application\/problem\+json/,
    );
    expect(response.body).toMatchObject({ status: 401, title: 'Unauthorized' });
  });

  it('개발용 로그인 → 현재 사용자 → 로그아웃', async () => {
    const name = uniqueName();
    const { response, header, token } = await login(name);
    expect(response.body).toMatchObject({
      displayName: name,
      profileImageUrl: null,
    });
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).not.toMatch(/Secure/i); // COOKIE_SECURE=false (로컬 개발)

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `session=${token}`)
      .expect(200);
    expect(me.body).toEqual(response.body);

    // 토큰 자체는 저장하지 않는다
    const stored = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).not.toBe(token);

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `session=${token}`)
      .expect(204);
    expect(sessionCookie(logout).token).toBe('');

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `session=${token}`)
      .expect(401);
  });

  it('같은 이름으로 다시 로그인하면 같은 사용자다', async () => {
    const name = uniqueName();
    const first = await login(name);
    const second = await login(name);
    expect(second.response.body.id).toBe(first.response.body.id);
    expect(second.token).not.toBe(first.token);
  });

  it('남은 기간이 15일 미만인 세션은 쓸 때 30일로 연장된다', async () => {
    const { token } = await login(uniqueName());
    const tokenHash = hashSessionToken(token);
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + 10 * DAY_MS) })
      .where(eq(sessions.tokenHash, tokenHash));

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `session=${token}`)
      .expect(200);
    expect(sessionCookie(me).token).toBe(token);

    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
    const remaining = row!.expiresAt.getTime() - Date.now();
    expect(remaining).toBeGreaterThan(29 * DAY_MS);
  });

  it('만료된 세션은 401이고 DB에서 지워진다', async () => {
    const { token } = await login(uniqueName());
    const tokenHash = hashSessionToken(token);
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.tokenHash, tokenHash));

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `session=${token}`)
      .expect(401);
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
    expect(rows).toHaveLength(0);
  });

  it('명세에 맞지 않는 요청은 Problem Details로 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ displayName: '' })
      .expect(400);
    expect(response.body).toMatchObject({ status: 400 });
  });
});

describe('개발용 로그인이 꺼져 있으면 (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp(false);
  });

  afterAll(async () => {
    await app.close();
  });

  it('엔드포인트가 없다', async () => {
    await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ displayName: '리더' })
      .expect(404);
  });
});
