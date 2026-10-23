import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'yaml';

const require = createRequire(import.meta.url);

/** API 계약의 원본. 실행 중에도 이 파일로 요청과 응답을 검사한다. */
export const OPENAPI_SPEC_PATH =
  require.resolve('@pray/api-contract/openapi.yaml');

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

type PathItem = Record<string, unknown>;
type SpecDocument = {
  paths?: Record<string, PathItem>;
  components?: { pathItems?: Record<string, PathItem> };
};

/**
 * 검사기에 넘길 명세를 읽는다. 개발 전용 엔드포인트(`x-dev-only: true`)가 꺼져 있으면 그 operation을 뺀다.
 * 그래야 등록하지 않은 엔드포인트를 검사기도 "없는 경로"로 다룬다(CONVENTIONS).
 */
export function loadApiSpec(options: { includeDevOnly: boolean }): object {
  const document = parse(
    readFileSync(OPENAPI_SPEC_PATH, 'utf8'),
  ) as SpecDocument;
  const resolved = withPathItemsInlined(document);
  return options.includeDevOnly ? resolved : withoutDevOnly(resolved);
}

/** 여러 경로가 함께 쓰는 정의(`$ref: '#/components/pathItems/…'`)를 각 경로에 펼친다. 검사기와 아래의 거르기가 경로마다 operation을 보게 한다. */
export function withPathItemsInlined<T extends SpecDocument>(document: T): T {
  const shared = document.components?.pathItems ?? {};
  const paths = Object.fromEntries(
    Object.entries(document.paths ?? {}).map(([path, item]) => {
      const ref = item.$ref;
      if (typeof ref !== 'string') {
        return [path, item];
      }
      const name = ref.replace('#/components/pathItems/', '');
      const target = shared[name];
      if (target === undefined) {
        throw new Error(`명세의 ${path}가 가리키는 ${ref}가 없습니다`);
      }
      return [path, target];
    }),
  );
  return { ...document, paths };
}

export function withoutDevOnly<T extends SpecDocument>(document: T): T {
  const paths: Record<string, PathItem> = {};
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    const kept = Object.fromEntries(
      Object.entries(item).filter(
        ([key, operation]) =>
          !(
            (HTTP_METHODS as readonly string[]).includes(key) &&
            (operation as { 'x-dev-only'?: unknown })['x-dev-only'] === true
          ),
      ),
    );
    if (HTTP_METHODS.some((method) => method in kept)) {
      paths[path] = kept;
    }
  }
  return { ...document, paths };
}
