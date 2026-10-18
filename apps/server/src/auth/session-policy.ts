// 웹 세션 정책(ARCHITECTURE의 "계정과 인증"): 30일, 남은 기간이 15일 미만이면 사용할 때 다시 30일로 늘린다.
import { createHash, randomBytes } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_DURATION_MS = 30 * DAY_MS;
export const SESSION_RENEW_THRESHOLD_MS = 15 * DAY_MS;

export type SessionCheck =
  { kind: 'expired' } | { kind: 'valid' } | { kind: 'renew'; expiresAt: Date };

export function newSessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_DURATION_MS);
}

export function checkSession(expiresAt: Date, now: Date): SessionCheck {
  const remaining = expiresAt.getTime() - now.getTime();
  if (remaining <= 0) {
    return { kind: 'expired' };
  }
  if (remaining < SESSION_RENEW_THRESHOLD_MS) {
    return { kind: 'renew', expiresAt: newSessionExpiry(now) };
  }
  return { kind: 'valid' };
}

/** 무작위 32바이트 토큰. 쿠키로만 주고 서버에는 저장하지 않는다. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** 토큰의 엔트로피가 충분하므로 느린 해시 없이 SHA-256으로 저장한다. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
