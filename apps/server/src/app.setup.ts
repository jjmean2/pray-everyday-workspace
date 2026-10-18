import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import { createRequire } from 'node:module';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';

const require = createRequire(import.meta.url);

/** API 계약의 원본. 실행 중에도 이 파일로 요청과 응답을 검사한다. */
export const OPENAPI_SPEC_PATH =
  require.resolve('@pray/api-contract/openapi.yaml');

/** 실제 서버와 e2e 테스트가 같은 설정으로 돌도록 앱 설정을 한곳에 둔다. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  // 검사기는 파싱된 본문을 본다. Nest의 본문 파서는 이 미들웨어들보다 늦게 붙으므로 여기서 먼저 파싱한다.
  // 이미 파싱된 요청은 Nest의 파서가 건너뛴다
  app.use(express.json());
  app.use(
    OpenApiValidator.middleware({
      apiSpec: OPENAPI_SPEC_PATH,
      validateRequests: true,
      // 응답 검사는 서버 버그를 잡는 장치라 개발과 테스트에서만 켠다
      validateResponses: process.env.NODE_ENV !== 'production',
      // 인증은 SessionGuard 한 곳에서 판단한다
      validateSecurity: false,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
}
