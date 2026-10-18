import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 저장소 루트의 .env(로컬 개발용)가 있으면 읽는다. 운영 환경은 환경 변수를 직접 받는다.
// ESM의 import는 먼저 실행되므로, 환경 변수에 기대는 모듈보다 먼저 불러야 한다(main.ts 참고).
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

/** 개발용 로그인은 DEV_LOGIN=true일 때만 켠다. */
export function isDevLoginEnabled(): boolean {
  return process.env.DEV_LOGIN === 'true';
}

/** 세션 쿠키의 Secure. 기본은 켜고, 로컬 개발에서만 COOKIE_SECURE=false로 끈다. */
export function isSecureCookie(): boolean {
  return process.env.COOKIE_SECURE !== 'false';
}

/** 운영 환경에서 위험한 설정이 켜져 있으면 서버를 시작하지 않는다. */
export function assertSafeEnv(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  if (isDevLoginEnabled()) {
    throw new Error(
      'NODE_ENV=production에서 DEV_LOGIN=true입니다. 개발용 로그인은 운영 환경에서 켤 수 없습니다.',
    );
  }
  if (!isSecureCookie()) {
    throw new Error(
      'NODE_ENV=production에서 COOKIE_SECURE=false입니다. 운영 환경의 세션 쿠키는 Secure여야 합니다.',
    );
  }
}
