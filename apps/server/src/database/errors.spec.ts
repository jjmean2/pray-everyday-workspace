import { isCheckViolation, isUniqueViolation } from './errors.js';

describe('PostgreSQL 오류 판정', () => {
  it('드라이버 오류와 Drizzle이 감싼 오류(cause) 모두 알아본다', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(
      isUniqueViolation(new Error('x', { cause: { code: '23505' } })),
    ).toBe(true);
    expect(isCheckViolation(new Error('x', { cause: { code: '23514' } }))).toBe(
      true,
    );
  });

  it('다른 오류는 아니다', () => {
    expect(isUniqueViolation({ code: '23514' })).toBe(false);
    expect(isCheckViolation(new Error('x'))).toBe(false);
  });
});
