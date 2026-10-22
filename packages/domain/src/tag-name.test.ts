import { describe, expect, it } from 'vitest';
import { normalizeTagName, sameTagName } from './tag-name.js';

describe('태그 이름', () => {
  it('앞뒤 공백을 잘라 저장한다', () => {
    expect(normalizeTagName('  새벽 기도 ')).toBe('새벽 기도');
  });

  it('앞뒤 공백과 대소문자를 무시하고 같은 이름으로 본다', () => {
    expect(sameTagName(' QT', 'qt ')).toBe(true);
    expect(sameTagName('새벽기도', '새벽 기도')).toBe(false);
  });
});
