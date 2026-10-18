import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import type { OpenApiValidatorOpts } from 'express-openapi-validator/dist/openapi.validator.js';
import { loadApiSpec } from './api-spec.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import { isDevLoginEnabled } from './env.js';

/**
 * 실제 서버와 e2e 테스트가 같은 설정으로 돌도록 앱 설정을 한곳에 둔다.
 * devLogin은 AuthModule.register에 준 값과 같아야 한다. 기본은 둘 다 DEV_LOGIN을 따른다.
 */
export function configureApp(
  app: INestApplication,
  options: { devLogin?: boolean } = {},
): void {
  const devLogin = options.devLogin ?? isDevLoginEnabled();
  app.use(cookieParser());
  // 검사기는 파싱된 본문을 본다. Nest의 본문 파서는 이 미들웨어들보다 늦게 붙으므로 여기서 먼저 파싱한다.
  // 이미 파싱된 요청은 Nest의 파서가 건너뛴다. 본문 파서 설정(크기 제한 등)은 여기서만 바꾼다
  app.use(express.json());
  app.use(
    OpenApiValidator.middleware({
      apiSpec: loadApiSpec({
        includeDevOnly: devLogin,
      }) as OpenApiValidatorOpts['apiSpec'],
      validateRequests: true,
      // 응답 검사는 서버 버그를 잡는 장치라 운영(NODE_ENV=production)이 아닐 때만 켠다
      validateResponses: process.env.NODE_ENV !== 'production',
      // 인증은 SessionGuard 한 곳에서 판단한다
      validateSecurity: false,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
}
