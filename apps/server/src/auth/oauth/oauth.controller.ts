import {
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { generateCodeVerifier, generateState } from 'arctic';
import type { Request, Response } from 'express';
import { AccountsService } from '../accounts.service.js';
import { setSessionCookie } from '../session-cookie.js';
import { SessionService } from '../session.service.js';
import {
  clearOAuthCookies,
  readOAuthCookies,
  setOAuthCookies,
} from './oauth-cookies.js';
import {
  OAUTH_PROVIDERS,
  type OAuthProfile,
  type OAuthProviders,
  type SocialProvider,
} from './oauth-provider.js';
import { safeReturnTo } from './return-to.js';

type LoginError =
  'cancelled' | 'invalid_state' | 'provider_error' | 'not_configured';

/**
 * 소셜 로그인(ARCHITECTURE의 "계정과 인증"). 브라우저가 이동하는 주소라 결과는 모두 302로 알린다.
 * 경로의 provider와 쿼리는 명세 검사기가 먼저 확인한다(kakao, google만 들어온다).
 */
@Controller('auth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    @Inject(OAUTH_PROVIDERS) private readonly providers: OAuthProviders,
    private readonly accounts: AccountsService,
    private readonly sessions: SessionService,
  ) {}

  @Get(':provider/login')
  login(
    @Param('provider') provider: SocialProvider,
    @Query('returnTo') returnTo: string | undefined,
    @Res() response: Response,
  ): void {
    const client = this.providers[provider];
    if (client === undefined) {
      return redirectWithError(response, 'not_configured');
    }
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    setOAuthCookies(response, {
      state,
      codeVerifier,
      returnTo: safeReturnTo(returnTo),
    });
    response.redirect(302, client.authorizationUrl(state, codeVerifier).href);
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: SocialProvider,
    @Query() query: { code?: string; state?: string; error?: string },
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const stored = readOAuthCookies(request);
    clearOAuthCookies(response);

    const client = this.providers[provider];
    if (client === undefined) {
      return redirectWithError(response, 'not_configured');
    }
    if (query.error !== undefined) {
      // 사용자가 동의 화면에서 취소하면 제공자는 access_denied를 준다
      return redirectWithError(
        response,
        query.error === 'access_denied' ? 'cancelled' : 'provider_error',
      );
    }
    if (
      query.code === undefined ||
      query.state === undefined ||
      stored.state === undefined ||
      stored.codeVerifier === undefined ||
      query.state !== stored.state
    ) {
      return redirectWithError(response, 'invalid_state');
    }

    let profile: OAuthProfile;
    try {
      profile = await client.fetchProfile(query.code, stored.codeVerifier);
    } catch (error) {
      this.logger.warn(`${provider} 로그인 실패: ${String(error)}`);
      return redirectWithError(response, 'provider_error');
    }

    const user = await this.accounts.findOrCreateUser(
      provider,
      profile.providerUserId,
      profile,
    );
    const { token, expiresAt } = await this.sessions.create(user.id);
    setSessionCookie(response, token, expiresAt);
    response.redirect(302, safeReturnTo(stored.returnTo));
  }
}

/** 웹의 첫 화면으로 보내고, 웹이 loginError를 보고 알린다. */
function redirectWithError(response: Response, error: LoginError): void {
  response.redirect(302, `/?loginError=${error}`);
}
