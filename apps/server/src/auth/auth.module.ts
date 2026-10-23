import { type DynamicModule, Module } from '@nestjs/common';
import { isDevLoginEnabled } from '../env.js';
import { AccountsService } from './accounts.service.js';
import { AuthController } from './auth.controller.js';
import { DevAuthController } from './dev-auth.controller.js';
import { OAuthController } from './oauth/oauth.controller.js';
import {
  OAUTH_PROVIDERS,
  type OAuthProviders,
} from './oauth/oauth-provider.js';
import { oauthProvidersFromEnv } from './oauth/providers-from-env.js';
import { SessionModule } from './session.module.js';

@Module({})
export class AuthModule {
  /**
   * 개발용 로그인은 기본으로 DEV_LOGIN을, 소셜 로그인 제공자는 환경 변수의 키를 따른다.
   * 테스트에서는 둘 다 직접 정할 수 있다(가짜 제공자).
   */
  static register(
    options: { devLogin?: boolean; oauthProviders?: OAuthProviders } = {},
  ): DynamicModule {
    const devLogin = options.devLogin ?? isDevLoginEnabled();
    return {
      module: AuthModule,
      controllers: [
        AuthController,
        OAuthController,
        ...(devLogin ? [DevAuthController] : []),
      ],
      imports: [SessionModule],
      providers: [
        AccountsService,
        {
          provide: OAUTH_PROVIDERS,
          useFactory: () => options.oauthProviders ?? oauthProvidersFromEnv(),
        },
      ],
    };
  }
}
