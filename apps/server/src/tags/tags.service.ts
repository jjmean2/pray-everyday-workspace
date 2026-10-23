import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Tag, TagInput, TagList } from '@pray/api-contract';
import { normalizeTagName } from '@pray/domain';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { nextPersonalChangeSeq, tags } from '../database/schema.js';
import { isUniqueViolation } from '../database/errors.js';

type TagRow = typeof tags.$inferSelect;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const bumped = () => ({
  version: sql`${tags.version} + 1`,
  updatedAt: new Date(),
  changeSeq: nextPersonalChangeSeq,
});

@Injectable()
export class TagsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(userId: string): Promise<TagList> {
    const rows = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)))
      .orderBy(asc(sql`lower(${tags.name})`), asc(tags.id));
    return { tags: rows.map(toTag) };
  }

  /**
   * 태그를 만들거나 이름을 바꾼다. 이름은 앞뒤 공백을 잘라 저장한다. 지운 태그는 되살리지 않는다(409).
   * 태그 행을 잠가 같은 태그의 저장과 삭제를 차례대로 처리한다.
   */
  async save(userId: string, tagId: string, input: TagInput): Promise<Tag> {
    const name = normalizeTagName(input.name);
    try {
      return await this.db.transaction(async (tx) => {
        let existing = await lockTag(tx, tagId);
        if (existing === undefined) {
          const [created] = await tx
            .insert(tags)
            .values({ id: tagId, userId, name })
            .onConflictDoNothing({ target: tags.id })
            .returning();
          if (created !== undefined) {
            return toTag(created);
          }
          // 같은 새 태그를 동시에 저장했다. 먼저 만든 것을 잠가 이어서 처리한다
          existing = await lockTag(tx, tagId);
        }
        if (existing === undefined || existing.userId !== userId) {
          throw new NotFoundException('태그를 찾을 수 없습니다');
        }
        // 되살리면 그사이 다시 저장된 노트에서는 이미 빠져 있어 레코드마다 결과가 달라진다
        if (existing.deletedAt !== null) {
          throw new ConflictException(
            '지운 태그입니다. 새 태그로 만들어 주세요',
          );
        }
        if (existing.name === name) {
          return toTag(existing);
        }
        const [row] = await tx
          .update(tags)
          .set({ name, ...bumped() })
          .where(eq(tags.id, tagId))
          .returning();
        return toTag(row!);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`같은 이름의 태그가 있습니다: ${name}`);
      }
      throw error;
    }
  }

  async delete(userId: string, tagId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existing = await lockTag(tx, tagId);
      if (existing === undefined || existing.userId !== userId) {
        throw new NotFoundException('태그를 찾을 수 없습니다');
      }
      if (existing.deletedAt !== null) {
        return;
      }
      await tx
        .update(tags)
        .set({ deletedAt: new Date(), ...bumped() })
        .where(eq(tags.id, tagId));
    });
  }
}

/** 태그 행을 읽으면서 잠근다(트랜잭션이 끝날 때까지). */
async function lockTag(
  tx: Transaction,
  tagId: string,
): Promise<TagRow | undefined> {
  const [row] = await tx
    .select()
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1)
    .for('update');
  return row;
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}
