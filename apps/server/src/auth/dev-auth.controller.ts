import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import type { CurrentUser, DevLoginRequest } from '@pray/api-contract';
import { and, eq } from 'drizzle-orm';
import type { Response } from 'express';
import { DATABASE, type Database } from '../database/database.module.js';
import { authAccounts, users } from '../database/schema.js';
import { toCurrentUser } from './current-user.js';
import { setSessionCookie } from './session-cookie.js';
import { SessionService, type UserRecord } from './session.service.js';

/**
 * 개발용 로그인(ARCHITECTURE의 "계정과 인증"). DEV_LOGIN=true일 때만 AuthModule이 등록한다.
 * 다른 로그인 수단처럼 제공자 `dev`의 로그인 수단과 세션을 만든다.
 * 요청 본문은 컨트롤러에 오기 전에 명세 검사기(app.setup.ts)가 DevLoginRequest로 검사한다.
 */
@Controller('auth/dev')
export class DevAuthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly sessions: SessionService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() { displayName }: DevLoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUser> {
    const user = await this.findOrCreateUser(displayName);
    const { token, expiresAt } = await this.sessions.create(user.id);
    setSessionCookie(response, token, expiresAt);
    return toCurrentUser(user);
  }

  private async findOrCreateUser(displayName: string): Promise<UserRecord> {
    const existing = await this.findUser(displayName);
    if (existing !== undefined) {
      return existing;
    }
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ displayName })
          .returning();
        await tx.insert(authAccounts).values({
          userId: user!.id,
          provider: 'dev',
          providerUserId: displayName,
        });
        return user!;
      });
    } catch (error) {
      // 같은 이름으로 동시에 로그인해 다른 요청이 먼저 만들었다면 그 사용자를 쓴다
      const created = await this.findUser(displayName);
      if (created !== undefined) {
        return created;
      }
      throw error;
    }
  }

  private async findUser(displayName: string): Promise<UserRecord | undefined> {
    const [row] = await this.db
      .select({ user: users })
      .from(authAccounts)
      .innerJoin(users, eq(authAccounts.userId, users.id))
      .where(
        and(
          eq(authAccounts.provider, 'dev'),
          eq(authAccounts.providerUserId, displayName),
        ),
      )
      .limit(1);
    return row?.user;
  }
}
