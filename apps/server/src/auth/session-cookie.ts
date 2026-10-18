import type { CookieOptions, Request, Response } from 'express';
import { isSecureCookie } from '../env.js';

/** 명세의 securitySchemes.sessionCookie와 같은 이름이다. */
export const SESSION_COOKIE = 'session';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    path: '/',
  };
}

export function readSessionToken(request: Request): string | undefined {
  const value: unknown = request.cookies?.[SESSION_COOKIE];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(SESSION_COOKIE, token, {
    ...baseOptions(),
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, baseOptions());
}
