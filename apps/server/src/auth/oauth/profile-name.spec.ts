import { DEFAULT_DISPLAY_NAME, socialDisplayName } from './profile-name.js';

describe('socialDisplayName', () => {
  it('이름이 없거나 공백뿐이면 기본 이름이다', () => {
    expect(socialDisplayName(null)).toBe(DEFAULT_DISPLAY_NAME);
    expect(socialDisplayName('   ')).toBe(DEFAULT_DISPLAY_NAME);
  });

  it('50자(코드 포인트)를 넘으면 자르고, 이모지를 반으로 자르지 않는다', () => {
    expect(socialDisplayName('🙏'.repeat(60))).toBe('🙏'.repeat(50));
    expect(socialDisplayName('은혜')).toBe('은혜');
  });
});
