import { defineConfig } from 'drizzle-kit';
import { loadLocalEnv, requireEnv } from './src/env.js';

loadLocalEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: { url: requireEnv('DATABASE_URL') },
});
