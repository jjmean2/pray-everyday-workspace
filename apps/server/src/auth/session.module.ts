import { Module } from '@nestjs/common';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

/** 세션 확인. 로그인이 필요한 API를 가진 모듈이 가져다 쓴다(SessionGuard). */
@Module({
  providers: [SessionService, SessionGuard],
  exports: [SessionService, SessionGuard],
})
export class SessionModule {}
