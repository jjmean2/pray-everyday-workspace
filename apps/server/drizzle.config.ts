import { defineConfig } from 'drizzle-kit';
import { loadLocalEnv, requireEnv } from './src/env.js';

loadLocalEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  // 마이그레이션은 연결 풀러를 거치지 않는 주소가 있으면 그것을 쓴다(Neon의 DATABASE_URL_UNPOOLED)
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || requireEnv('DATABASE_URL'),
  },
});
