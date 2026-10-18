import { loadApiSpec, withoutDevOnly } from './api-spec.js';

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
  });
});
