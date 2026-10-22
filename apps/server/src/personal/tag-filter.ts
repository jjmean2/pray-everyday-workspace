import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../database/database.module.js';
import { tags } from '../database/schema.js';

type Reader = Pick<Database, 'select'>;

/** 사용자의 살아 있는(삭제 표시되지 않은) 태그 ID. 노트와 기도제목의 태그 목록을 읽을 때 걸러 내는 데 쓴다. */
export async function liveTagIds(
  db: Reader,
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)));
  return new Set(rows.map((row) => row.id));
}

/** 삭제 표시된 태그의 ID를 빼고 돌려준다(ADR-0007). */
export function onlyLive(tagIds: string[], live: Set<string>): string[] {
  return tagIds.filter((id) => live.has(id));
}
