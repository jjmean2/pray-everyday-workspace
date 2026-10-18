import { assertSafeEnv } from './env.js';

describe('assertSafeEnv', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  function setEnv(values: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  it('운영 환경에서 개발용 로그인이 켜져 있으면 시작하지 않는다', () => {
    setEnv({
      NODE_ENV: 'production',
      DEV_LOGIN: 'true',
      COOKIE_SECURE: undefined,
    });
    expect(() => assertSafeEnv()).toThrow(/DEV_LOGIN/);
  });

  it('운영 환경에서 쿠키의 Secure를 끄면 시작하지 않는다', () => {
    setEnv({
      NODE_ENV: 'production',
      DEV_LOGIN: undefined,
      COOKIE_SECURE: 'false',
    });
    expect(() => assertSafeEnv()).toThrow(/COOKIE_SECURE/);
  });

  it('운영 환경의 안전한 설정은 통과한다', () => {
    setEnv({
      NODE_ENV: 'production',
      DEV_LOGIN: undefined,
      COOKIE_SECURE: undefined,
    });
    expect(() => assertSafeEnv()).not.toThrow();
  });

  it('운영 환경이 아니면 개발용 설정을 허용한다', () => {
    setEnv({
      NODE_ENV: 'development',
      DEV_LOGIN: 'true',
      COOKIE_SECURE: 'false',
    });
    expect(() => assertSafeEnv()).not.toThrow();
  });
});
