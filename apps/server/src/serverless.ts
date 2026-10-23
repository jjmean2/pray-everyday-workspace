// Vercel 함수 진입점(ADR-0008). api/index.js가 빌드 결과(dist/serverless.js)를 내보낸다.
// 로컬 개발과 상시 실행 서버는 main.ts를 쓰고, 앱 설정(app.setup.ts)은 둘이 같다.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './app.setup.js';
import { assertSafeEnv } from './env.js';

assertSafeEnv();

// 환경 변수를 확인한 뒤에 앱 모듈을 불러온다(main.ts와 같은 이유)
const { AppModule } = await import('./app.module.js');

// 함수 인스턴스마다 앱을 한 번 만들고 요청 사이에 다시 쓴다. 요청의 상태는 두지 않는다(CONVENTIONS)
const app = await NestFactory.create(AppModule);
configureApp(app);
await app.init();
const handle = app.getHttpAdapter().getInstance() as (
  request: IncomingMessage,
  response: ServerResponse,
) => void;

export default function handler(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  handle(request, response);
}
