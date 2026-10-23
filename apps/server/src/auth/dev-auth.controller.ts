import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { CurrentUser, DevLoginRequest } from '@pray/api-contract';
import type { Response } from 'express';
import { AccountsService } from './accounts.service.js';
import { toCurrentUser } from './current-user.js';
import { setSessionCookie } from './session-cookie.js';
import { SessionService } from './session.service.js';

/**
 * 개발용 로그인(ARCHITECTURE의 "계정과 인증"). DEV_LOGIN=true일 때만 AuthModule이 등록한다.
 * 다른 로그인 수단처럼 제공자 `dev`의 로그인 수단과 세션을 만든다.
 * 요청 본문은 컨트롤러에 오기 전에 명세 검사기(app.setup.ts)가 DevLoginRequest로 검사한다.
 */
@Controller('auth/dev')
export class DevAuthController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly sessions: SessionService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() { displayName }: DevLoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUser> {
    // 표시 이름이 곧 로그인 수단의 ID다
    const user = await this.accounts.findOrCreateUser('dev', displayName, {
      displayName,
      profileImageUrl: null,
    });
    const { token, expiresAt } = await this.sessions.create(user.id);
    setSessionCookie(response, token, expiresAt);
    return toCurrentUser(user);
  }
}
