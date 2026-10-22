/** PostgreSQL 오류 코드. Drizzle은 드라이버 오류를 cause로 감싼다. */
function pgErrorCode(error: unknown): unknown {
  return (
    (error as { code?: unknown }).code ??
    (error as { cause?: { code?: unknown } }).cause?.code
  );
}

/** 고유 제약 위반(23505) */
export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23505';
}

/** CHECK 제약 위반(23514) */
export function isCheckViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23514';
}
