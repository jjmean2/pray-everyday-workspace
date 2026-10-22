import { defineConfig } from 'vitest/config';

// 단위 테스트는 앱의 Vite 플러그인(TanStack Start 등) 없이 순수 모듈만 돌린다
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
