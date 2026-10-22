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
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import {
  nextPersonalChangeSeq,
  notes,
  prayerItems,
  sortKeyOrder,
} from '../database/schema.js';
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

  /** 노트를 기도제목과 함께 통째로 저장한다(ADR-0007). 빠진 기도제목은 삭제 표시한다. */
  async save(userId: string, noteId: string, input: NoteInput): Promise<Note> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(notes)
        .where(eq(notes.id, noteId))
        .limit(1);
      if (existing !== undefined && existing.userId !== userId) {
        throw new NotFoundException('노트를 찾을 수 없습니다');
      }

      await this.assertKnownTags(tx, userId, input);
      const currentItems = await this.itemsForSave(tx, userId, noteId, input);

      if (existing === undefined) {
        await tx.insert(notes).values({
          id: noteId,
          userId,
          prayedAt: new Date(input.prayedAt),
          memo: input.memo,
          tagIds: input.tagIds,
        });
      } else if (noteChanged(existing, input)) {
        await tx
          .update(notes)
          .set({
            prayedAt: new Date(input.prayedAt),
            memo: input.memo,
            tagIds: input.tagIds,
            deletedAt: null,
            ...bumped(notes),
          })
          .where(eq(notes.id, noteId));
      }

      await this.saveItems(tx, userId, noteId, input.items, currentItems);
      return this.getIn(tx, userId, noteId);
    });
  }

  /** 노트와 그 기도제목에 삭제 표시를 한다. 이미 삭제 표시됐으면 그대로 둔다. */
  async delete(userId: string, noteId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [note] = await tx
        .select()
        .from(notes)
        .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
        .limit(1);
      if (note === undefined) {
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
    return rows.map((row) => ({
      id: row.id,
      prayedAt: row.prayedAt.toISOString(),
      memo: row.memo,
      tagIds: onlyLive(row.tagIds, live),
      items: items
        .filter((item) => item.noteId === row.id)
        .map((item) => toPrayerItem(item, live)),
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private async assertKnownTags(
    tx: Transaction,
    userId: string,
    input: NoteInput,
  ): Promise<void> {
    const requested = new Set([
      ...input.tagIds,
      ...input.items.flatMap((item) => item.tagIds),
    ]);
    if (requested.size === 0) {
      return;
    }
    const live = await liveTagIds(tx, userId);
    const unknown = [...requested].filter((id) => !live.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `알 수 없는 태그입니다: ${unknown.join(', ')}`,
      );
    }
  }

  /** 이 노트의 기존 기도제목(삭제 표시 포함). 보낸 ID가 다른 노트의 것이면 409. */
  private async itemsForSave(
    tx: Transaction,
    userId: string,
    noteId: string,
    input: NoteInput,
  ): Promise<Map<string, ItemRow>> {
    const ids = input.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('같은 기도제목 ID가 두 번 있습니다');
    }
    if (ids.length > 0) {
      const elsewhere = await tx
        .select({ id: prayerItems.id })
        .from(prayerItems)
        .where(
          and(
            inArray(prayerItems.id, ids),
            sql`(${prayerItems.noteId} <> ${noteId} or ${prayerItems.userId} <> ${userId})`,
          ),
        );
      if (elsewhere.length > 0) {
        throw new ConflictException(
          `다른 노트의 기도제목 ID입니다: ${elsewhere.map((row) => row.id).join(', ')}`,
        );
      }
    }
    const rows = await tx
      .select()
      .from(prayerItems)
      .where(eq(prayerItems.noteId, noteId));
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async saveItems(
    tx: Transaction,
    userId: string,
    noteId: string,
    inputs: PrayerItemInput[],
    current: Map<string, ItemRow>,
  ): Promise<void> {
    const sent = new Set(inputs.map((item) => item.id));
    for (const input of inputs) {
      const row = current.get(input.id);
      const values = {
        sortKey: input.sortKey,
        title: input.title,
        detail: input.detail,
        tagIds: input.tagIds,
      };
      if (row === undefined) {
        await tx
          .insert(prayerItems)
          .values({ id: input.id, userId, noteId, ...values });
      } else if (itemChanged(row, input)) {
        await tx
          .update(prayerItems)
          .set({ ...values, deletedAt: null, ...bumped(prayerItems) })
          .where(eq(prayerItems.id, input.id));
      }
    }
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
  }
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function noteChanged(row: NoteRow, input: NoteInput): boolean {
  return (
    row.deletedAt !== null ||
    row.prayedAt.getTime() !== new Date(input.prayedAt).getTime() ||
    row.memo !== input.memo ||
    !sameIds(row.tagIds, input.tagIds)
  );
}

function itemChanged(row: ItemRow, input: PrayerItemInput): boolean {
  return (
    row.deletedAt !== null ||
    row.sortKey !== input.sortKey ||
    row.title !== input.title ||
    row.detail !== input.detail ||
    !sameIds(row.tagIds, input.tagIds)
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
