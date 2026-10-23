/**
 * 로그인한 뒤 돌아갈 경로. 앱 안의 경로(`/`로 시작)만 받고, 다른 사이트로 보내는 값은 `/`로 바꾼다(open redirect 방지).
 * `//host`와 `/\host`는 브라우저가 다른 사이트로 해석하고, 탭과 줄바꿈은 브라우저가 지워서 `/\t/host`가 `//host`가 된다.
 */
export function safeReturnTo(value: string | undefined): string {
  if (
    value === undefined ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    // 제어 문자를 일부러 찾는다
    // oxlint-disable-next-line no-control-regex
    /[\\\u0000-\u001f\u007f]/.test(value)
  ) {
    return '/';
  }
  return value;
}
