import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';

/** 실제 서버와 e2e 테스트가 같은 설정으로 돌도록 앱 설정을 한곳에 둔다. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalFilters(new ProblemDetailsFilter());
}
