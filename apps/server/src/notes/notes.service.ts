import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Note,
  NoteInput,
  NoteList,
  PrayerItem,
  PrayerItemInput,
} from '@pray/api-contract';
import { compareSortKeys, isValidSortKey } from '@pray/domain';
import { and, desc, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DATABASE, type Database } from '../database/database.module.js';
import {
  nextPersonalChangeSeq,
  notes,
  prayerItems,
  sortKeyOrder,
} from '../database/schema.js';
import { isCheckViolation } from '../database/errors.js';
import { liveTagIds, onlyLive } from '../personal/tag-filter.js';
import { decodeNoteCursor, encodeNoteCursor } from './note-cursor.js';

type NoteRow = typeof notes.$inferSelect;
type ItemRow = typeof prayerItems.$inferSelect;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const DEFAULT_LIMIT = 20;

/** 바꿀 때마다 버전을 올리고 새 변경 순번을 받는다(동기화 장치). */
const bumped = (table: typeof notes | typeof prayerItems) => ({
  version: sql`${table.version} + 1`,
  updatedAt: new Date(),
  changeSeq: nextPersonalChangeSeq,
});

@Injectable()
export class NotesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(
    userId: string,
    cursorValue: string | undefined,
    limit = DEFAULT_LIMIT,
  ): Promise<NoteList> {
    const cursor =
      cursorValue === undefined ? undefined : decodeNoteCursor(cursorValue);
    const rows = await this.db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          isNull(notes.deletedAt),
          cursor === undefined
            ? undefined
            : sql`(${notes.prayedAt}, ${notes.id}) < (${cursor.prayedAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
        ),
      )
      .orderBy(desc(notes.prayedAt), desc(notes.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      notes: await this.withItems(this.db, userId, page),
      nextCursor:
        rows.length > limit && last !== undefined
          ? encodeNoteCursor({ prayedAt: last.prayedAt, id: last.id })
          : null,
    };
  }

  async get(userId: string, noteId: string): Promise<Note> {
    return this.getIn(this.db, userId, noteId);
  }

  /**
   * 노트를 기도제목과 함께 통째로 저장한다(ADR-0007). 빠진 기도제목은 삭제 표시한다.
   * 노트 행을 잠가 같은 노트의 저장과 삭제를 차례대로 처리하고, 기도제목은 바뀐 것만 한 번에 쓴다.
   */
  async save(userId: string, noteId: string, input: NoteInput): Promise<Note> {
    try {
      return await this.saveInTransaction(userId, noteId, input);
    } catch (error) {
      // 명세 검사(JS 정규식)와 DB 제약(PostgreSQL 정규식)의 공백 판정이 다른 드문 경우에도 400으로 돌려준다
      if (isCheckViolation(error)) {
        throw new BadRequestException(
          '기도제목은 제목과 상세 중 하나 이상에 공백이 아닌 글자가 있어야 합니다',
        );
      }
      throw error;
    }
  }

  private async saveInTransaction(
    userId: string,
    noteId: string,
    input: NoteInput,
  ): Promise<Note> {
    assertValidSortKeys(input);
    const ids = input.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('같은 기도제목 ID가 두 번 있습니다');
    }

    return this.db.transaction(async (tx) => {
      const locked = await this.lockOrCreateNote(tx, userId, noteId, input);
      const currentItems = await this.itemsForSave(tx, noteId, ids);
      const live = await this.assertKnownTags(tx, userId, input);

      let note = locked.row;
      if (!locked.created && noteChanged(note, input, live)) {
        const [updated] = await tx
          .update(notes)
          .set({
            prayedAt: new Date(input.prayedAt),
            memo: input.memo,
            tagIds: input.tagIds,
            deletedAt: null,
            ...bumped(notes),
          })
          .where(eq(notes.id, noteId))
          .returning();
        note = updated!;
      }

      const written = await this.saveItems(
        tx,
        userId,
        noteId,
        input.items,
        currentItems,
        live,
      );

      // 다시 읽지 않고 응답을 만든다: 보낸 기도제목 중 안 바뀐 것은 읽어 둔 행, 바뀐 것은 쓴 결과
      const items = input.items
        .map((item) => written.get(item.id) ?? currentItems.get(item.id)!)
        .sort(compareItemRows);
      return toNote(note, items, live);
    });
  }

  /**
   * 노트 행을 잠근다. 없으면 보낸 내용으로 만든다. 다른 사람의 노트는 404.
   * 같은 새 노트를 동시에 저장하면 나중 것은 먼저 것이 커밋할 때까지 기다렸다가 기존 노트로 이어서 처리한다.
   */
  private async lockOrCreateNote(
    tx: Transaction,
    userId: string,
    noteId: string,
    input: NoteInput,
  ): Promise<{ row: NoteRow; created: boolean }> {
    let row = await lockNote(tx, noteId);
    if (row === undefined) {
      const [created] = await tx
        .insert(notes)
        .values({
          id: noteId,
          userId,
          prayedAt: new Date(input.prayedAt),
          memo: input.memo,
          tagIds: input.tagIds,
        })
        .onConflictDoNothing({ target: notes.id })
        .returning();
      if (created !== undefined) {
        return { row: created, created: true };
      }
      row = await lockNote(tx, noteId);
    }
    if (row === undefined || row.userId !== userId) {
      throw new NotFoundException('노트를 찾을 수 없습니다');
    }
    return { row, created: false };
  }

  /** 노트와 그 기도제목에 삭제 표시를 한다. 이미 삭제 표시됐으면 그대로 둔다. */
  async delete(userId: string, noteId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const note = await lockNote(tx, noteId);
      if (note === undefined || note.userId !== userId) {
        throw new NotFoundException('노트를 찾을 수 없습니다');
      }
      if (note.deletedAt !== null) {
        return;
      }
      const now = new Date();
      await tx
        .update(notes)
        .set({ deletedAt: now, ...bumped(notes) })
        .where(eq(notes.id, noteId));
      await tx
        .update(prayerItems)
        .set({ deletedAt: now, ...bumped(prayerItems) })
        .where(
          and(eq(prayerItems.noteId, noteId), isNull(prayerItems.deletedAt)),
        );
    });
  }

  private async getIn(
    db: Database | Transaction,
    userId: string,
    noteId: string,
  ): Promise<Note> {
    const [row] = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.userId, userId),
          isNull(notes.deletedAt),
        ),
      )
      .limit(1);
    if (row === undefined) {
      throw new NotFoundException('노트를 찾을 수 없습니다');
    }
    const [note] = await this.withItems(db, userId, [row]);
    return note!;
  }

  private async withItems(
    db: Database | Transaction,
    userId: string,
    rows: NoteRow[],
  ): Promise<Note[]> {
    if (rows.length === 0) {
      return [];
    }
    const [items, live] = await Promise.all([
      db
        .select()
        .from(prayerItems)
        .where(
          and(
            inArray(
              prayerItems.noteId,
              rows.map((row) => row.id),
            ),
            isNull(prayerItems.deletedAt),
          ),
        )
        .orderBy(sortKeyOrder, prayerItems.id),
      liveTagIds(db, userId),
    ]);
    return rows.map((row) =>
      toNote(
        row,
        items.filter((item) => item.noteId === row.id),
        live,
      ),
    );
  }

  private async assertKnownTags(
    tx: Transaction,
    userId: string,
    input: NoteInput,
  ): Promise<Set<string>> {
    const requested = new Set([
      ...input.tagIds,
      ...input.items.flatMap((item) => item.tagIds),
    ]);
    const live = await liveTagIds(tx, userId);
    const unknown = [...requested].filter((id) => !live.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `알 수 없는 태그입니다: ${unknown.join(', ')}`,
      );
    }
    return live;
  }

  /** 이 노트의 기존 기도제목(삭제 표시 포함). 보낸 ID가 다른 노트의 것이면 409. */
  private async itemsForSave(
    tx: Transaction,
    noteId: string,
    ids: string[],
  ): Promise<Map<string, ItemRow>> {
    const rows = await tx
      .select()
      .from(prayerItems)
      .where(
        or(
          eq(prayerItems.noteId, noteId),
          ids.length > 0 ? inArray(prayerItems.id, ids) : undefined,
        ),
      );
    const elsewhere = rows.filter((row) => row.noteId !== noteId);
    if (elsewhere.length > 0) {
      throw otherNoteItem(elsewhere.map((row) => row.id));
    }
    return new Map(rows.map((row) => [row.id, row]));
  }

  /** 바뀌거나 새로 생긴 기도제목을 한 번에 쓰고, 빠진 것은 삭제 표시한다. 쓴 행을 돌려준다. */
  private async saveItems(
    tx: Transaction,
    userId: string,
    noteId: string,
    inputs: PrayerItemInput[],
    current: Map<string, ItemRow>,
    live: Set<string>,
  ): Promise<Map<string, ItemRow>> {
    // ID 순으로 써서, 두 노트가 같은 새 ID 여럿을 다른 순서로 보내도 서로 기다리다 교착하지 않게 한다
    const changed = inputs
      .filter((input) => {
        const row = current.get(input.id);
        return row === undefined || itemChanged(row, input, live);
      })
      .sort((a, b) => compareSortKeys(a.id, b.id));
    const written = new Map<string, ItemRow>();
    if (changed.length > 0) {
      const rows = await tx
        .insert(prayerItems)
        .values(
          changed.map((input) => ({
            id: input.id,
            userId,
            noteId,
            sortKey: input.sortKey,
            title: input.title,
            detail: input.detail,
            tagIds: input.tagIds,
          })),
        )
        .onConflictDoUpdate({
          target: prayerItems.id,
          set: {
            sortKey: excluded(prayerItems.sortKey),
            title: excluded(prayerItems.title),
            detail: excluded(prayerItems.detail),
            tagIds: excluded(prayerItems.tagIds),
            deletedAt: null,
            ...bumped(prayerItems),
          },
          // 읽은 뒤에 다른 노트가 같은 ID를 먼저 쓴 경우, 그 행은 고치지 않는다(아래에서 409)
          setWhere: sql`${prayerItems.noteId} = excluded.note_id`,
        })
        .returning();
      for (const row of rows) {
        written.set(row.id, row);
      }
      const taken = changed.filter((input) => !written.has(input.id));
      if (taken.length > 0) {
        throw otherNoteItem(taken.map((input) => input.id));
      }
    }

    const sent = new Set(inputs.map((item) => item.id));
    const removed = [...current.values()].filter(
      (row) => !sent.has(row.id) && row.deletedAt === null,
    );
    if (removed.length > 0) {
      await tx
        .update(prayerItems)
        .set({ deletedAt: new Date(), ...bumped(prayerItems) })
        .where(
          inArray(
            prayerItems.id,
            removed.map((row) => row.id),
          ),
        );
    }
    return written;
  }
}

/** 노트 행을 읽으면서 잠근다(트랜잭션이 끝날 때까지). */
async function lockNote(
  tx: Transaction,
  noteId: string,
): Promise<NoteRow | undefined> {
  const [row] = await tx
    .select()
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1)
    .for('update');
  return row;
}

/** upsert에서 충돌한 행 대신 넣으려던 값 */
function excluded(column: AnyPgColumn): SQL {
  return sql.raw(`excluded.${column.name}`);
}

function otherNoteItem(ids: string[]): ConflictException {
  return new ConflictException(
    `다른 노트의 기도제목 ID입니다: ${ids.join(', ')}`,
  );
}

/** DB의 정렬(sortKeyOrder, id)과 같은 순서 */
function compareItemRows(a: ItemRow, b: ItemRow): number {
  return compareSortKeys(a.sortKey, b.sortKey) || compareSortKeys(a.id, b.id);
}

function toNote(row: NoteRow, items: ItemRow[], live: Set<string>): Note {
  return {
    id: row.id,
    prayedAt: row.prayedAt.toISOString(),
    memo: row.memo,
    tagIds: onlyLive(row.tagIds, live),
    items: items.map((item) => toPrayerItem(item, live)),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function assertValidSortKeys(input: NoteInput): void {
  const invalid = input.items.filter((item) => !isValidSortKey(item.sortKey));
  if (invalid.length > 0) {
    throw new BadRequestException(
      `정렬 키의 형식이 맞지 않습니다: ${invalid.map((item) => item.sortKey).join(', ')}`,
    );
  }
}

// 태그는 지운 것을 걸러 낸 값으로 비교한다. 읽을 때 걸러 낸 목록을 그대로 다시 보내면 바뀐 것이 없다
function noteChanged(
  row: NoteRow,
  input: NoteInput,
  live: Set<string>,
): boolean {
  return (
    row.deletedAt !== null ||
    row.prayedAt.getTime() !== new Date(input.prayedAt).getTime() ||
    row.memo !== input.memo ||
    !sameIds(onlyLive(row.tagIds, live), input.tagIds)
  );
}

function itemChanged(
  row: ItemRow,
  input: PrayerItemInput,
  live: Set<string>,
): boolean {
  return (
    row.deletedAt !== null ||
    row.sortKey !== input.sortKey ||
    row.title !== input.title ||
    row.detail !== input.detail ||
    !sameIds(onlyLive(row.tagIds, live), input.tagIds)
  );
}

function toPrayerItem(row: ItemRow, live: Set<string>): PrayerItem {
  return {
    id: row.id,
    sortKey: row.sortKey,
    title: row.title,
    detail: row.detail,
    tagIds: onlyLive(row.tagIds, live),
    threadId: row.threadId,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}
