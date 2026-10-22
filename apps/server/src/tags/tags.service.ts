import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Tag, TagInput, TagList } from '@pray/api-contract';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { nextPersonalChangeSeq, tags } from '../database/schema.js';
import { isUniqueViolation } from '../database/errors.js';

type TagRow = typeof tags.$inferSelect;

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

  /** 태그를 만들거나 이름을 바꾼다. 삭제 표시된 태그를 다시 보내면 되살린다. */
  async save(userId: string, tagId: string, input: TagInput): Promise<Tag> {
    const [existing] = await this.db
      .select()
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);
    if (existing !== undefined && existing.userId !== userId) {
      throw new NotFoundException('태그를 찾을 수 없습니다');
    }
    try {
      if (existing === undefined) {
        const [row] = await this.db
          .insert(tags)
          .values({ id: tagId, userId, name: input.name })
          .returning();
        return toTag(row!);
      }
      if (existing.name === input.name && existing.deletedAt === null) {
        return toTag(existing);
      }
      const [row] = await this.db
        .update(tags)
        .set({ name: input.name, deletedAt: null, ...bumped() })
        .where(eq(tags.id, tagId))
        .returning();
      return toTag(row!);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `같은 이름의 태그가 있습니다: ${input.name}`,
        );
      }
      throw error;
    }
  }

  async delete(userId: string, tagId: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
      .limit(1);
    if (existing === undefined) {
      throw new NotFoundException('태그를 찾을 수 없습니다');
    }
    if (existing.deletedAt !== null) {
      return;
    }
    await this.db
      .update(tags)
      .set({ deletedAt: new Date(), ...bumped() })
      .where(eq(tags.id, tagId));
  }
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}
