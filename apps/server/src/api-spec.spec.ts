import {
  loadApiSpec,
  withoutDevOnly,
  withPathItemsInlined,
} from './api-spec.js';

describe('withoutDevOnly', () => {
  it('x-dev-only operation을 빼고, operation이 남지 않은 경로는 지운다', () => {
    const document = {
      openapi: '3.1.0',
      paths: {
        '/auth/me': { get: { operationId: 'getCurrentUser' } },
        '/auth/dev/login': {
          post: { operationId: 'devLogin', 'x-dev-only': true },
        },
        '/mixed': {
          parameters: [],
          get: { operationId: 'keep' },
          post: { operationId: 'drop', 'x-dev-only': true },
        },
      },
    };
    expect(withoutDevOnly(document).paths).toEqual({
      '/auth/me': { get: { operationId: 'getCurrentUser' } },
      '/mixed': { parameters: [], get: { operationId: 'keep' } },
    });
  });
});

describe('withPathItemsInlined', () => {
  it('함께 쓰는 경로 정의를 각 경로에 펼친다', () => {
    const shared = { get: { summary: '로그인 시작' } };
    const document = {
      paths: {
        '/a': { $ref: '#/components/pathItems/Shared' },
        '/b': { $ref: '#/components/pathItems/Shared' },
        '/c': { get: {} },
      },
      components: { pathItems: { Shared: shared } },
    };
    expect(withPathItemsInlined(document).paths).toEqual({
      '/a': shared,
      '/b': shared,
      '/c': { get: {} },
    });
  });

  it('가리키는 정의가 없으면 실패한다', () => {
    expect(() =>
      withPathItemsInlined({
        paths: { '/a': { $ref: '#/components/pathItems/Missing' } },
      }),
    ).toThrow('Missing');
  });
});

describe('loadApiSpec', () => {
  it('실제 명세에서 개발용 로그인을 뺄 수 있다', () => {
    const full = loadApiSpec({ includeDevOnly: true }) as {
      paths: Record<string, unknown>;
    };
    const withoutDev = loadApiSpec({ includeDevOnly: false }) as {
      paths: Record<string, unknown>;
    };
    expect(full.paths).toHaveProperty(['/auth/dev/login']);
    expect(withoutDev.paths).not.toHaveProperty(['/auth/dev/login']);
    expect(withoutDev.paths).toHaveProperty(['/auth/me']);
    expect(withoutDev.paths).toHaveProperty(['/auth/kakao/callback', 'get']);
  });
});
