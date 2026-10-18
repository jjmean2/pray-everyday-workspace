import {
  checkSession,
  generateSessionToken,
  hashSessionToken,
  newSessionExpiry,
  SESSION_DURATION_MS,
} from './session-policy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-18T00:00:00Z');
const daysLater = (days: number) => new Date(now.getTime() + days * DAY_MS);

describe('세션 정책', () => {
  it('새 세션은 30일 뒤에 만료된다', () => {
    expect(newSessionExpiry(now).getTime() - now.getTime()).toBe(
      SESSION_DURATION_MS,
    );
  });

  it('남은 기간이 15일 이상이면 그대로 쓴다', () => {
    expect(checkSession(daysLater(15), now)).toEqual({ kind: 'valid' });
    expect(checkSession(daysLater(29), now)).toEqual({ kind: 'valid' });
  });

  it('남은 기간이 15일 미만이면 다시 30일로 늘린다', () => {
    expect(checkSession(daysLater(14), now)).toEqual({
      kind: 'renew',
      expiresAt: daysLater(30),
    });
  });

  it('만료 시각이 지났으면 만료다', () => {
    expect(checkSession(now, now)).toEqual({ kind: 'expired' });
    expect(checkSession(daysLater(-1), now)).toEqual({ kind: 'expired' });
  });

  it('토큰은 매번 다르고, 해시는 같은 토큰에 대해 같다', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(hashSessionToken(a)).toBe(hashSessionToken(a));
    expect(hashSessionToken(a)).not.toBe(a);
  });
});
