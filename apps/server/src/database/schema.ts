// Drizzle 테이블 정의.
// 클라이언트가 만드는 레코드는 동기화 장치(클라이언트 생성 ID, 버전, 수정 시각, 삭제 표시, 변경 순번)를 갖는다.
// 사용자와 세션처럼 서버가 만드는 레코드는 서버가 ID를 만들고 동기화하지 않는다(ARCHITECTURE의 불변식).
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
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
