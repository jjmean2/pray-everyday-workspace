import type { CookieOptions, Request, Response } from 'express';
import { isSecureCookie } from '../../env.js';

// 로그인 시작부터 콜백까지만 쓰는 쿠키. 제공자에서 돌아오는 이동(최상위 GET)에도 실리도록 SameSite=Lax다.
const STATE = 'oauth_state';
const CODE_VERIFIER = 'oauth_code_verifier';
const RETURN_TO = 'oauth_return_to';
const MAX_AGE_MS = 10 * 60 * 1000;

function options(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    path: '/',
  };
}

export interface OAuthCookies {
  state: string;
  codeVerifier: string;
  returnTo: string;
}

export function setOAuthCookies(
  response: Response,
  values: OAuthCookies,
): void {
  const withAge = { ...options(), maxAge: MAX_AGE_MS };
  response.cookie(STATE, values.state, withAge);
  response.cookie(CODE_VERIFIER, values.codeVerifier, withAge);
  response.cookie(RETURN_TO, values.returnTo, withAge);
}

/** 없거나 만료된 쿠키는 undefined다. */
export function readOAuthCookies(
  request: Request,
): Record<keyof OAuthCookies, string | undefined> {
  const cookies = (request.cookies ?? {}) as Record<string, unknown>;
  const read = (name: string) =>
    typeof cookies[name] === 'string' && cookies[name] !== ''
      ? cookies[name]
      : undefined;
  return {
    state: read(STATE),
    codeVerifier: read(CODE_VERIFIER),
    returnTo: read(RETURN_TO),
  };
}

export function clearOAuthCookies(response: Response): void {
  for (const name of [STATE, CODE_VERIFIER, RETURN_TO]) {
    response.clearCookie(name, options());
  }
}
