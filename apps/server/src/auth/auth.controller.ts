import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CurrentUser } from '@pray/api-contract';
import type { Request, Response } from 'express';
import { toCurrentUser } from './current-user.js';
import { clearSessionCookie, readSessionToken } from './session-cookie.js';
import { CurrentSession, SessionGuard } from './session.guard.js';
import { SessionService, type ValidatedSession } from './session.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly sessions: SessionService) {}

  @Get('me')
  @UseGuards(SessionGuard)
  getCurrentUser(@CurrentSession() session: ValidatedSession): CurrentUser {
    return toCurrentUser(session.user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readSessionToken(request);
    if (token !== undefined) {
      await this.sessions.invalidate(token);
    }
    clearSessionCookie(response);
  }
}
