import { describe, expect, it } from 'vitest';
import { compareSortKeys, isValidSortKey, sortKeyBetween } from './sort-key.js';

describe('정렬 키', () => {
  it('두 키 사이의 키를 만들고, 바이트 순서로 그 사이에 온다', () => {
    const first = sortKeyBetween(null, null);
    const last = sortKeyBetween(first, null);
    const middle = sortKeyBetween(first, last);
    expect([last, middle, first].sort(compareSortKeys)).toEqual([
      first,
      middle,
      last,
    ]);
  });

  it('명세의 형식(영숫자)만 쓴다', () => {
    let key = sortKeyBetween(null, null);
    for (let i = 0; i < 50; i += 1) {
      key = sortKeyBetween(null, key);
      expect(key).toMatch(/^[0-9A-Za-z]+$/);
    }
  });

  it('형식에 맞지 않는 키를 가려낸다', () => {
    expect(isValidSortKey(sortKeyBetween(null, null))).toBe(true);
    expect(isValidSortKey('a0V')).toBe(true);
    // 정수부 길이가 머리 글자와 맞지 않는다
    expect(isValidSortKey('b0')).toBe(false);
    // 소수부가 0으로 끝난다
    expect(isValidSortKey('a0V0')).toBe(false);
    expect(isValidSortKey('0')).toBe(false);
  });
});
