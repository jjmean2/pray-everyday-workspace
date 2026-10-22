import { type DynamicModule, Module } from '@nestjs/common';
import { isDevLoginEnabled } from '../env.js';
import { AuthController } from './auth.controller.js';
import { DevAuthController } from './dev-auth.controller.js';
import { SessionModule } from './session.module.js';

@Module({})
export class AuthModule {
  /** 개발용 로그인은 기본으로 DEV_LOGIN을 따른다. 테스트에서는 직접 정할 수 있다. */
  static register(options: { devLogin?: boolean } = {}): DynamicModule {
    const devLogin = options.devLogin ?? isDevLoginEnabled();
    return {
      module: AuthModule,
      controllers: devLogin
        ? [AuthController, DevAuthController]
        : [AuthController],
      imports: [SessionModule],
    };
  }
}
