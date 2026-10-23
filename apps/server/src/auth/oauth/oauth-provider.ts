// 소셜 로그인 제공자와의 통신(ARCHITECTURE의 "계정과 인증"). 컨트롤러는 이 인터페이스만 알고,
// 테스트는 가짜 제공자로 바꾼다.

export const SOCIAL_PROVIDERS = ['kakao', 'google'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/** 제공자가 알려 준 사용자. 이름과 사진은 동의하지 않았으면 없다. */
export interface OAuthProfile {
  providerUserId: string;
  displayName: string | null;
  profileImageUrl: string | null;
}

export interface OAuthProvider {
  /** 제공자의 로그인 화면 주소. PKCE를 쓰지 않는 제공자는 codeVerifier를 쓰지 않는다 */
  authorizationUrl(state: string, codeVerifier: string): URL;
  /** 콜백으로 받은 코드를 토큰으로 바꾸고 사용자를 조회한다. 토큰은 저장하지 않는다 */
  fetchProfile(code: string, codeVerifier: string): Promise<OAuthProfile>;
}

/** 설정된 제공자만 들어 있다. */
export type OAuthProviders = Partial<Record<SocialProvider, OAuthProvider>>;

export const OAUTH_PROVIDERS = Symbol('OAUTH_PROVIDERS');
