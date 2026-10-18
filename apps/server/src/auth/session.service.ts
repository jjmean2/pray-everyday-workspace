import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { sessions, users } from '../database/schema.js';
import {
  checkSession,
  generateSessionToken,
  hashSessionToken,
  newSessionExpiry,
} from './session-policy.js';

export type UserRecord = typeof users.$inferSelect;

export interface ValidatedSession {
  user: UserRecord;
  sessionId: string;
  expiresAt: Date;
  /** 이번 확인으로 만료 시각이 늘어났다. 쿠키도 새 만료 시각으로 다시 줘야 한다 */
  renewed: boolean;
}

@Injectable()
export class SessionService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(
    userId: string,
    now = new Date(),
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = generateSessionToken();
    const expiresAt = newSessionExpiry(now);
    await this.db
      .insert(sessions)
      .values({ tokenHash: hashSessionToken(token), userId, expiresAt });
    return { token, expiresAt };
  }

  async validate(
    token: string,
    now = new Date(),
  ): Promise<ValidatedSession | null> {
    const tokenHash = hashSessionToken(token);
    const [row] = await this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    if (row === undefined) {
      return null;
    }

    const result = checkSession(row.session.expiresAt, now);
    if (result.kind === 'expired') {
      await this.db.delete(sessions).where(eq(sessions.id, row.session.id));
      return null;
    }
    if (result.kind === 'renew') {
      await this.db
        .update(sessions)
        .set({ expiresAt: result.expiresAt })
        .where(eq(sessions.id, row.session.id));
    }
    return {
      user: row.user,
      sessionId: row.session.id,
      expiresAt:
        result.kind === 'renew' ? result.expiresAt : row.session.expiresAt,
      renewed: result.kind === 'renew',
    };
  }

  async invalidate(token: string): Promise<void> {
    await this.db
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)));
  }
}
