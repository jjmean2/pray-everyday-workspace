export const DEFAULT_DISPLAY_NAME = '기도하는 사람';
const DISPLAY_NAME_MAX = 50;

/**
 * 소셜 제공자가 준 이름으로 표시 이름을 만든다(ARCHITECTURE의 "계정과 인증").
 * 없거나 공백뿐이면 기본 이름이고, 50자(코드 포인트)를 넘으면 자른다. 개발용 로그인은 이 규칙을 쓰지 않는다.
 */
export function socialDisplayName(name: string | null): string {
  if (name === null || name.trim() === '') {
    return DEFAULT_DISPLAY_NAME;
  }
  return Array.from(name).slice(0, DISPLAY_NAME_MAX).join('');
}
