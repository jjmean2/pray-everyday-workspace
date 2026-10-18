import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // e2e는 로컬 개발 DB(docker compose)에 붙는다. 개발용 로그인과 로컬 쿠키 설정을 켠다
    env: { DEV_LOGIN: 'true', COOKIE_SECURE: 'false' },
  },
});
