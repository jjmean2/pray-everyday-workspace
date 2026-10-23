import { decodeIdToken, Google } from 'arctic';
import type { OAuthProfile, OAuthProvider } from './oauth-provider.js';

interface GoogleClaims {
  sub: string;
  name?: string;
  picture?: string;
}

/** 구글 로그인. PKCE를 쓰고 `openid profile`만 요청한다. */
export class GoogleProvider implements OAuthProvider {
  private readonly client: Google;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.client = new Google(clientId, clientSecret, redirectUri);
  }

  authorizationUrl(state: string, codeVerifier: string): URL {
    return this.client.createAuthorizationURL(state, codeVerifier, [
      'openid',
      'profile',
    ]);
  }

  async fetchProfile(
    code: string,
    codeVerifier: string,
  ): Promise<OAuthProfile> {
    const tokens = await this.client.validateAuthorizationCode(
      code,
      codeVerifier,
    );
    // 구글의 토큰 엔드포인트에서 TLS로 직접 받은 ID 토큰이라 서명 검증 없이 읽는다(OpenID Connect Core 3.1.3.7)
    const claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
    return {
      providerUserId: claims.sub,
      displayName: claims.name ?? null,
      profileImageUrl: claims.picture ?? null,
    };
  }
}
