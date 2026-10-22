// Drizzle 테이블 정의.
// 클라이언트가 만드는 레코드는 동기화 장치(클라이언트 생성 ID, 버전, 수정 시각, 삭제 표시, 변경 순번)를 갖는다.
// 사용자와 세션처럼 서버가 만드는 레코드는 서버가 ID를 만들고 동기화하지 않는다(ARCHITECTURE의 불변식).
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const serverId = () =>
  uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`);
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** 사용자. 서버가 만든다. */
export const users = pgTable('users', {
  id: serverId(),
  displayName: text('display_name').notNull(),
  profileImageUrl: text('profile_image_url'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const AUTH_PROVIDERS = ['kakao', 'google', 'dev'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/** 로그인 수단. 사용자 한 명이 여러 개를 가질 수 있고, 이메일로 자동 연결하지 않는다. */
export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: serverId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: AUTH_PROVIDERS }).notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique('auth_accounts_provider_user_unique').on(
      table.provider,
      table.providerUserId,
    ),
    index('auth_accounts_user_id_idx').on(table.userId),
    check(
      'auth_accounts_provider_check',
      sql`${table.provider} in ('kakao', 'google', 'dev')`,
    ),
  ],
);

/** 세션. 토큰은 저장하지 않고 SHA-256 해시만 저장한다. */
export const sessions = pgTable(
  'sessions',
  {
    id: serverId(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

// ── 개인 기록 (ARCHITECTURE의 "개인 기록 모델"과 "데이터 원본과 동기화", ADR-0007) ──

/** 개인 기록의 변경 순번. 노트, 기도제목, 태그가 바뀔 때마다 새 값을 받는다. */
export const personalChangeSeq = pgSequence('personal_change_seq');
export const nextPersonalChangeSeq = sql`nextval('personal_change_seq')`;

/** 클라이언트가 만든 ID. 서버는 만들지 않는다. */
const clientId = () => uuid('id').primaryKey();

/** 동기화 장치: 버전(서버가 올림), 수정 시각, 삭제 표시, 변경 순번. */
const syncColumns = () => ({
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  changeSeq: bigint('change_seq', { mode: 'number' })
    .notNull()
    .default(nextPersonalChangeSeq),
});

const tagIdsColumn = () =>
  uuid('tag_ids')
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`);

/** 태그. 이름은 사용자 안에서 대소문자를 무시하고 겹치지 않는다(삭제 표시된 것 제외). */
export const tags = pgTable(
  'tags',
  {
    id: clientId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ...syncColumns(),
  },
  (table) => [
    uniqueIndex('tags_user_name_unique')
      .on(table.userId, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} is null`),
    index('tags_user_change_seq_idx').on(table.userId, table.changeSeq),
  ],
);

/** 노트. 한 번에 쓴 기도 기록. */
export const notes = pgTable(
  'notes',
  {
    id: clientId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    prayedAt: timestamp('prayed_at', { withTimezone: true }).notNull(),
    memo: text('memo'),
    tagIds: tagIdsColumn(),
    ...syncColumns(),
  },
  (table) => [
    index('notes_user_prayed_at_idx')
      .on(table.userId, table.prayedAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    index('notes_user_change_seq_idx').on(table.userId, table.changeSeq),
    index('notes_tag_ids_idx').using('gin', table.tagIds),
  ],
);

/** 기도제목. 노트 안의 항목 하나. 순서는 분수 인덱스(sort_key)이고 바이트 순서로 정렬한다. */
export const prayerItems = pgTable(
  'prayer_items',
  {
    id: clientId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    sortKey: text('sort_key').notNull(),
    title: text('title'),
    detail: text('detail'),
    tagIds: tagIdsColumn(),
    threadId: uuid('thread_id'),
    ...syncColumns(),
  },
  (table) => [
    // 정렬 키는 바이트 순서로 비교한다. 쿼리도 같은 collation으로 정렬해야 이 인덱스를 쓴다(sortKeyOrder)
    index('prayer_items_note_sort_idx').on(
      table.noteId,
      sql`${table.sortKey} collate "C"`,
    ),
    index('prayer_items_user_change_seq_idx').on(table.userId, table.changeSeq),
    index('prayer_items_user_thread_idx')
      .on(table.userId, table.threadId)
      .where(sql`${table.threadId} is not null`),
    index('prayer_items_tag_ids_idx').using('gin', table.tagIds),
    // 삭제 표시되지 않았다면 제목과 상세 중 하나는 공백이 아닌 글자를 가진다(불변식)
    check(
      'prayer_items_content_check',
      sql`${table.deletedAt} is not null or coalesce(${table.title} ~ '\\S', false) or coalesce(${table.detail} ~ '\\S', false)`,
    ),
  ],
);

/** 정렬 키의 정렬. 분수 인덱스는 바이트 순서로 비교해야 한다(DB의 기본 collation과 무관하게). */
export const sortKeyOrder = sql`${prayerItems.sortKey} collate "C"`;
