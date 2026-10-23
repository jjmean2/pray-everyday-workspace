import { safeReturnTo } from './return-to.js';

describe('safeReturnTo', () => {
  it('앱 안의 경로는 그대로 둔다', () => {
    expect(safeReturnTo('/notes/abc?x=1')).toBe('/notes/abc?x=1');
    expect(safeReturnTo('/')).toBe('/');
  });

  it('다른 사이트로 갈 수 있는 값은 /로 바꾼다', () => {
    for (const value of [
      undefined,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/\t/evil.example',
      'notes',
    ]) {
      expect(safeReturnTo(value)).toBe('/');
    }
  });
});
