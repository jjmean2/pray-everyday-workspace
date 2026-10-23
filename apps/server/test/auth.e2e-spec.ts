import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../src/app.setup.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { hashSessionToken } from '../src/auth/session-policy.js';
import {
  DATABASE,
  type Database,
  DatabaseModule,
} from '../src/database/database.module.js';
import { sessions } from '../src/database/schema.js';
import type {
  OAuthProfile,
  OAuthProviders,
} from '../src/auth/oauth/oauth-provider.js';
import { loadLocalEnv } from '../src/env.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function createApp(
  devLogin: boolean,
  oauthProviders: OAuthProviders = {},
): Promise<INestApplication<App>> {
  loadLocalEnv();
  const moduleRef = await Test.createTestingModule({
    imports: [
      DatabaseModule,
      AuthModule.register({ devLogin, oauthProviders }),
    ],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app, { devLogin });
  await app.init();
  return app;
}

/** Set-Cookie에서 세션 쿠키 한 줄과 토큰을 꺼낸다. */
function sessionCookie(response: request.Response): {
  header: string;
  token: string;
} {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  const header = raw?.find((line) => line.startsWith('session='));
  if (header === undefined) {
    throw new Error('세션 쿠키가 없다');
  }
  const token = decodeURIComponent(
    header.split(';')[0]!.slice('session='.length),
  );
  return { header, token };
}

describe('인증 (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;

  beforeAll(async () => {
    app = await createApp(true);
    db = app.get(DATABASE);
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueName = () => `e2e-${randomUUID().slice(0, 8)}`;

  async function login(displayName: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ displayName })
      .expect(200);
    return { response, ...sessionCookie(response) };
  }

  it('로그인하지 않으면 /auth/me는 Problem Details로 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);
    expect(response.headers['content-type']).toMatch(
      /^application\/problem\+json/,
    );
    expect(response.body).toMatchObject({ status: 401, title: 'Unauthorized' });
  });

  it('개발용 로그인 → 현재 사용자 → 로그아웃', async () => {
    const name = uniqueName();
    const { response, header, token } = await login(name);
    expect(response.body).toMatchObject({
      displayName: name,
      profileImageUrl: null,
    });
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).not.toMatch(/Secure/i); // COOKIE_SECURE=false (로컬 개발)

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `session=${token}`)
      .expect(200);
    expect(me.body).toEqual(response.body);

    // 토큰 자체는 저장하지 않는다
    const stored = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).not.toBe(token);

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `session=${token}`)
      .expect(204);
    expect(sessionCookie(logout).token).toBe('');

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `session=${token}`)
      .expect(401);
  });

  it('같은 이름으로 다시 로그인하면 같은 사용자다', async () => {
    const name = uniqueName();
    const first = await login(name);
    const second = await login(name);
    expect(second.response.body.id).toBe(first.response.body.id);
    expect(second.token).not.toBe(first.token);
  });

  it('남은 기간이 15일 미만인 세션은 쓸 때 30일로 연장된다', async () => {
    const { token } = await login(uniqueName());
    const tokenHash = hashSessionToken(token);
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + 10 * DAY_MS) })
      .where(eq(sessions.tokenHash, tokenHash));

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `session=${token}`)
      .expect(200);
    expect(sessionCookie(me).token).toBe(token);

    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
    const remaining = row!.expiresAt.getTime() - Date.now();
    expect(remaining).toBeGreaterThan(29 * DAY_MS);
  });

  it('만료된 세션은 401이고 DB에서 지워진다', async () => {
    const { token } = await login(uniqueName());
    const tokenHash = hashSessionToken(token);
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.tokenHash, tokenHash));

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `session=${token}`)
      .expect(401);
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
    expect(rows).toHaveLength(0);
  });

  describe('요청은 명세(DevLoginRequest)로 검사한다', () => {
    it.each([
      ['빈 이름', { displayName: '' }, '/body/displayName'],
      ['51자', { displayName: '가'.repeat(51) }, '/body/displayName'],
      ['문자열이 아님', { displayName: 3 }, '/body/displayName'],
      ['필드 없음', {}, 'displayName'],
      ['명세에 없는 필드', { displayName: '리더', role: 'admin' }, 'role'],
    ])('%s이면 Problem Details로 400', async (_label, body, mentions) => {
      const response = await request(app.getHttpServer())
        .post('/auth/dev/login')
        .send(body)
        .expect(400);
      expect(response.headers['content-type']).toMatch(
        /^application\/problem\+json/,
      );
      expect(response.body).toMatchObject({
        status: 400,
        title: 'Bad Request',
      });
      expect(response.body.detail).toContain(mentions);
    });

    it('명세 그대로 받는다: 공백을 다듬지 않고, 길이는 코드 포인트로 센다', async () => {
      const spaced = `  ${uniqueName()}  `;
      const first = await login(spaced);
      expect(first.response.body.displayName).toBe(spaced);

      const emoji50 = `${'🙏'.repeat(42)}${randomUUID().slice(0, 8)}`;
      const second = await login(emoji50);
      expect(second.response.body.displayName).toBe(emoji50);
    });
  });
});

describe('개발용 로그인이 꺼져 있으면 (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp(false);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['맞는 본문', { displayName: '리더' }],
    ['틀린 본문', { displayName: '' }],
  ])('엔드포인트가 없다 (%s도 404)', async (_label, body) => {
    // 검사기도 개발용 엔드포인트를 모른다. 틀린 본문에 400을 주면 엔드포인트가 있는 것처럼 보인다
    const response = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send(body)
      .expect(404);
    expect(response.headers['content-type']).toMatch(
      /^application\/problem\+json/,
    );
  });
});

describe('소셜 로그인 (e2e, 가짜 제공자)', () => {
  let app: INestApplication<App>;
  /** 코드마다 제공자가 돌려줄 프로필. 없는 코드면 제공자 오류를 낸다 */
  const profiles = new Map<string, OAuthProfile>();
  const received: { code: string; codeVerifier: string }[] = [];

  beforeAll(async () => {
    app = await createApp(false, {
      kakao: {
        authorizationUrl: (state) =>
          new URL(`https://kakao.test/authorize?state=${state}`),
        fetchProfile: async (code, codeVerifier) => {
          received.push({ code, codeVerifier });
          const profile = profiles.get(code);
          if (profile === undefined) {
            throw new Error('잘못된 코드');
          }
          return profile;
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  /** 로그인을 시작하고, 제공자로 보낸 state와 브라우저가 받은 쿠키를 돌려준다. */
  async function start(returnTo?: string) {
    const response = await request(app.getHttpServer())
      .get('/auth/kakao/login')
      .query(returnTo === undefined ? {} : { returnTo })
      .expect(302);
    const location = new URL(response.headers.location!);
    const cookies = (response.headers['set-cookie'] as unknown as string[]).map(
      (line) => line.split(';')[0]!,
    );
    return { state: location.searchParams.get('state')!, cookies, location };
  }

  function callback(cookies: string[], query: Record<string, string>) {
    return request(app.getHttpServer())
      .get('/auth/kakao/callback')
      .set('Cookie', cookies)
      .query(query);
  }

  it('로그인을 시작하면 state를 쿠키에 두고 제공자로 보낸다', async () => {
    const { state, cookies, location } = await start('/notes/abc');
    expect(location.host).toBe('kakao.test');
    expect(state).not.toBe('');
    expect(cookies).toContain(`oauth_state=${state}`);
  });

  it('콜백: 처음이면 사용자를 만들고, 세션 쿠키를 주고 returnTo로 보낸다. 다음 로그인은 같은 사용자이고 이름을 덮어쓰지 않는다', async () => {
    const providerUserId = `kakao-${randomUUID()}`;
    profiles.set('code-1', {
      providerUserId,
      displayName: '은혜',
      profileImageUrl: 'https://img.test/a.png',
    });
    const first = await start('/notes/abc');
    const done = await callback(first.cookies, {
      code: 'code-1',
      state: first.state,
      // 제공자가 붙이는 다른 파라미터는 무시한다
      scope: 'profile_nickname',
    }).expect(302);
    expect(done.headers.location).toBe('/notes/abc');
    const { header } = sessionCookie(done);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', header.split(';')[0]!)
      .expect(200);
    expect(me.body).toMatchObject({
      displayName: '은혜',
      profileImageUrl: 'https://img.test/a.png',
    });
    // 로그인 시작 때 만든 code verifier가 제공자에게 그대로 간다
    expect(received.at(-1)!.codeVerifier).toBe(
      decodeURIComponent(
        first.cookies
          .find((cookie) => cookie.startsWith('oauth_code_verifier='))!
          .split('=')[1]!,
      ),
    );

    profiles.set('code-2', {
      providerUserId,
      displayName: '바뀐 닉네임',
      profileImageUrl: null,
    });
    const second = await start();
    const again = await callback(second.cookies, {
      code: 'code-2',
      state: second.state,
    }).expect(302);
    expect(again.headers.location).toBe('/');
    const meAgain = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', sessionCookie(again).header.split(';')[0]!)
      .expect(200);
    expect(meAgain.body).toEqual(me.body);
  });

  it('이름을 주지 않으면 기본 이름이다', async () => {
    profiles.set('code-noname', {
      providerUserId: `kakao-${randomUUID()}`,
      displayName: null,
      profileImageUrl: null,
    });
    const { state, cookies } = await start();
    const done = await callback(cookies, {
      code: 'code-noname',
      state,
    }).expect(302);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', sessionCookie(done).header.split(';')[0]!)
      .expect(200);
    expect(me.body.displayName).toBe('기도하는 사람');
  });

  it('returnTo는 /를 인코딩하지 않아도 받는다', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/kakao/login?returnTo=/notes/abc')
      .expect(302);
    expect(
      (response.headers['set-cookie'] as unknown as string[]).some((line) =>
        line.startsWith('oauth_return_to=%2Fnotes%2Fabc'),
      ),
    ).toBe(true);
  });

  it('다른 사이트로 가는 returnTo는 /로 바꾼다', async () => {
    profiles.set('code-redirect', {
      providerUserId: `kakao-${randomUUID()}`,
      displayName: '은혜',
      profileImageUrl: null,
    });
    const { state, cookies } = await start('//evil.example/path');
    const done = await callback(cookies, {
      code: 'code-redirect',
      state,
    }).expect(302);
    expect(done.headers.location).toBe('/');
  });

  it('실패하면 세션 없이 /?loginError=<코드>로 보낸다', async () => {
    const cases: [Record<string, string>, boolean, string][] = [
      // [쿼리, 시작할 때의 쿠키를 보내는가, 오류 코드]
      [{ error: 'access_denied' }, true, 'cancelled'],
      [{ code: 'code-1', state: 'other' }, true, 'invalid_state'],
      [{ code: 'code-1', state: 'x' }, false, 'invalid_state'],
      [{ code: 'unknown-code' }, true, 'provider_error'],
    ];
    for (const [query, withCookies, error] of cases) {
      const { state, cookies } = await start();
      const response = await callback(withCookies ? cookies : [], {
        state,
        ...query,
      }).expect(302);
      expect(response.headers.location).toBe(`/?loginError=${error}`);
      const raw = (response.headers['set-cookie'] ?? []) as unknown as string[];
      expect(raw.some((line) => line.startsWith('session='))).toBe(false);
    }
  });

  it('설정되지 않은 제공자는 not_configured로, 모르는 제공자는 404다', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/google/login')
      .expect(302);
    expect(response.headers.location).toBe('/?loginError=not_configured');
    await request(app.getHttpServer()).get('/auth/naver/login').expect(404);
  });
});
