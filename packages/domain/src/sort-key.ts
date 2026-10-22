// 노트 안의 기도제목 순서를 정하는 분수 인덱스(ADR-0007). 클라이언트(웹, 나중의 앱)가 키를 만들고,
// 서버는 바이트 순서로 정렬하기만 한다. 키 형식은 fractional-indexing 4의 기본 형식(A-Z, a-z 머리 + 62진수)이다.
import { generateKeyBetween } from 'fractional-indexing';

/** before와 after 사이에 오는 새 키. 처음이나 끝이면 null을 넘긴다. */
export function sortKeyBetween(
  before: string | null,
  after: string | null,
): string {
  return generateKeyBetween(before, after);
}

/** 정렬 키의 비교. 서버의 COLLATE "C"(바이트 순서)와 같다. */
export function compareSortKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** fractional-indexing 4의 기본 형식에 맞는 키인가. 서버가 받은 키를 검사할 때 쓴다(형식이 틀린 키는 다음 키를 만들 수 없다). */
export function isValidSortKey(key: string): boolean {
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}
