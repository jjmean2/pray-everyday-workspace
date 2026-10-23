import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { type AuthProvider, authAccounts, users } from '../database/schema.js';
import type { UserRecord } from './session.service.js';

/** 새 사용자의 이름과 사진. 로그인 수단마다 정한 규칙으로 만든 값을 그대로 저장한다. */
export interface NewUserProfile {
  displayName: string;
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
            displayName: profile.displayName,
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
