import {
  BadRequestException,
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
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUser> {
    const { displayName } = parseDevLoginRequest(body);
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

/**
 * 명세의 DevLoginRequest를 명세 그대로 직접 검사한다. 명세에 없는 규칙(공백 다듬기 등)을 더하지 않는다.
 * 길이는 JSON Schema처럼 코드 포인트로 센다.
 * 요청 검증 방식이 아직 열린 질문이라 정할 때까지의 타협이다(notes/architecture.md의 [타협]).
 */
export function parseDevLoginRequest(body: unknown): DevLoginRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('요청 본문은 JSON 객체여야 합니다');
  }
  const keys = Object.keys(body);
  if (keys.some((key) => key !== 'displayName')) {
    throw new BadRequestException('displayName 외의 필드는 받지 않습니다');
  }
  const displayName = (body as { displayName?: unknown }).displayName;
  if (typeof displayName !== 'string') {
    throw new BadRequestException('displayName은 문자열이어야 합니다');
  }
  // JSON Schema의 maxLength는 코드 포인트로 센다. 명세와 같게 세려고 일부러 코드 포인트로 나눈다
  // oxlint-disable-next-line typescript/no-misused-spread
  const length = [...displayName].length;
  if (length < 1 || length > 50) {
    throw new BadRequestException(
      'displayName은 1자 이상 50자 이하여야 합니다',
    );
  }
  return { displayName };
}
