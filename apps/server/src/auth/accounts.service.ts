import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { type AuthProvider, authAccounts, users } from '../database/schema.js';
import type { UserRecord } from './session.service.js';

export const DEFAULT_DISPLAY_NAME = '기도하는 사람';
const DISPLAY_NAME_MAX = 50;

export interface NewUserProfile {
  displayName: string | null;
  profileImageUrl: string | null;
}

/** 로그인 수단으로 사용자를 찾고, 없으면 사용자와 로그인 수단을 함께 만든다. */
@Injectable()
export class AccountsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** 이름과 사진은 처음 만들 때만 쓰고, 이미 있는 사용자는 덮어쓰지 않는다. */
  async findOrCreateUser(
    provider: AuthProvider,
    providerUserId: string,
    profile: NewUserProfile,
  ): Promise<UserRecord> {
    const existing = await this.findUser(provider, providerUserId);
    if (existing !== undefined) {
      return existing;
    }
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            displayName: toDisplayName(profile.displayName),
            profileImageUrl: profile.profileImageUrl,
          })
          .returning();
        await tx
          .insert(authAccounts)
          .values({ userId: user!.id, provider, providerUserId });
        return user!;
      });
    } catch (error) {
      // 같은 로그인 수단으로 동시에 로그인해 다른 요청이 먼저 만들었다면 그 사용자를 쓴다
      const created = await this.findUser(provider, providerUserId);
      if (created !== undefined) {
        return created;
      }
      throw error;
    }
  }

  private async findUser(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<UserRecord | undefined> {
    const [row] = await this.db
      .select({ user: users })
      .from(authAccounts)
      .innerJoin(users, eq(authAccounts.userId, users.id))
      .where(
        and(
          eq(authAccounts.provider, provider),
          eq(authAccounts.providerUserId, providerUserId),
        ),
      )
      .limit(1);
    return row?.user;
  }
}

/** 제공자가 이름을 주지 않았거나 비어 있으면 기본 이름을 쓴다. 길면 자른다. */
function toDisplayName(name: string | null): string {
  if (name === null || name.trim() === '') {
    return DEFAULT_DISPLAY_NAME;
  }
  // 명세처럼 코드 포인트로 센다(이모지가 반으로 잘리지 않게)
  return Array.from(name).slice(0, DISPLAY_NAME_MAX).join('');
}
