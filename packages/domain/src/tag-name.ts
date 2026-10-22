// 태그 이름의 규칙. 서버와 클라이언트가 같은 규칙으로 저장하고 겹침을 판단한다.
// 서버의 겹침 검사는 DB의 lower()가 맡고, 이 함수는 클라이언트가 미리 판단할 때 쓴다.

/** 저장할 이름. 앞뒤 공백을 잘라 낸다. */
export function normalizeTagName(name: string): string {
  return name.trim();
}

/** 같은 이름인가. 앞뒤 공백과 대소문자를 무시한다. */
export function sameTagName(a: string, b: string): boolean {
  return (
    normalizeTagName(a).toLowerCase() === normalizeTagName(b).toLowerCase()
  );
}
