import { Kakao } from 'arctic';
import type { OAuthProfile, OAuthProvider } from './oauth-provider.js';

interface KakaoUser {
  id: number;
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      is_default_image?: boolean;
    };
  };
}

/** 카카오 로그인. 닉네임(필수 동의)과 프로필 사진(선택 동의)만 받는다. Arctic의 카카오 클라이언트는 PKCE 없이 state만 쓴다. */
export class KakaoProvider implements OAuthProvider {
  private readonly client: Kakao;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.client = new Kakao(clientId, clientSecret, redirectUri);
  }

  authorizationUrl(state: string): URL {
    return this.client.createAuthorizationURL(state, [
      'profile_nickname',
      'profile_image',
    ]);
  }

  async fetchProfile(code: string): Promise<OAuthProfile> {
    const tokens = await this.client.validateAuthorizationCode(code);
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });
    if (!response.ok) {
      throw new Error(`카카오 사용자 조회 실패: ${response.status}`);
    }
    const user = (await response.json()) as KakaoUser;
    const profile = user.kakao_account?.profile;
    const image =
      profile?.is_default_image === true
        ? undefined
        : profile?.profile_image_url;
    return {
      providerUserId: String(user.id),
      displayName: profile?.nickname ?? null,
      // 카카오가 http 주소를 줄 때가 있어, https 페이지에서 섞인 콘텐츠가 되지 않게 바꾼다
      profileImageUrl: image?.replace(/^http:\/\//, 'https://') ?? null,
    };
  }
}
