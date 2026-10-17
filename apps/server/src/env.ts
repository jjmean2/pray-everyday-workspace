import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 저장소 루트의 .env(로컬 개발용)가 있으면 읽는다. 운영 환경은 환경 변수를 직접 받는다.
export function loadLocalEnv(): void {
  const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `환경 변수 ${name}가 없습니다. 로컬 개발이면 .env.example을 .env로 복사하세요.`,
    );
  }
  return value;
}
