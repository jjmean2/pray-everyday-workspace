import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { readSessionToken, setSessionCookie } from './session-cookie.js';
import { SessionService, type ValidatedSession } from './session.service.js';

type AuthenticatedRequest = Request & { auth?: ValidatedSession };

/** 로그인이 필요한 API에 붙인다. 세션을 확인하고, 연장됐으면 쿠키를 다시 준다. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request);
    const session =
      token === undefined ? null : await this.sessions.validate(token);
    if (token === undefined || session === null) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }
    if (session.renewed) {
      setSessionCookie(http.getResponse<Response>(), token, session.expiresAt);
    }
    request.auth = session;
    return true;
  }
}

/** SessionGuard를 거친 요청의 세션. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ValidatedSession => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.auth === undefined) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }
    return request.auth;
  },
);
