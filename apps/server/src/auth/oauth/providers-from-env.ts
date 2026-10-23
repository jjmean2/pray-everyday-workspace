import { GoogleProvider } from './google.provider.js';
import { KakaoProvider } from './kakao.provider.js';
import type { OAuthProviders, SocialProvider } from './oauth-provider.js';

/** 콜백 주소: 브라우저가 보는 API 주소(OAUTH_REDIRECT_BASE) + /auth/{제공자}/callback */
export function callbackUrl(base: string, provider: SocialProvider): string {
  return `${base.replace(/\/+$/, '')}/auth/${provider}/callback`;
}

/** 키가 있는 제공자만 만든다. 없는 제공자로는 로그인할 수 없다(운영 환경은 assertSafeEnv가 막는다). */
export function oauthProvidersFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): OAuthProviders {
  const base = env.OAUTH_REDIRECT_BASE;
  if (base === undefined || base === '') {
    return {};
  }
  const providers: OAuthProviders = {};
  if (env.KAKAO_CLIENT_ID && env.KAKAO_CLIENT_SECRET) {
    providers.kakao = new KakaoProvider(
      env.KAKAO_CLIENT_ID,
      env.KAKAO_CLIENT_SECRET,
      callbackUrl(base, 'kakao'),
    );
  }
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = new GoogleProvider(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      callbackUrl(base, 'google'),
    );
  }
  return providers;
}
