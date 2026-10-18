# 컨벤션: 쌓이는 기도 (시스템 전체)

구현할 때 지킬 설계 수준의 규칙을 현재 상태로 적는다. 바뀌면 고쳐 쓰고, 이력은 git에 둔다.
lint와 formatter로 강제할 수 있는 규칙은 그 도구에 두고, 에이전트의 작업 절차는 `AGENTS.md`에 둔다. 하위 스코프는 상위 규칙에 더하기만 한다.

## 저장소 구성

- 실행되는 애플리케이션은 `apps/`, 함께 쓰는 패키지는 `packages/`에 둔다
- 웹과 서버가 함께 쓰는 도메인 규칙은 `packages/domain`에 둔다

## API와 웹

- API를 바꿀 때는 `packages/api-contract/openapi.yaml`을 먼저 고치고, 생성된 타입으로 서버와 웹을 구현한다. 이유: [ADR-0003](decisions/0003-web-framework-api-contract-runtime.md)
- TanStack Start의 server functions에는 비즈니스 로직을 두지 않는다. SSR에 필요한 조회도 API 계약을 거쳐 서버를 부른다. 클라이언트와 서버의 책임은 [영역과 모듈의 경계](ARCHITECTURE.md#영역과-모듈의-경계)를 따른다. 이유: [ADR-0003](decisions/0003-web-framework-api-contract-runtime.md)

## 의존성

- 의존성 설치 스크립트는 pnpm이 기본으로 막는다. 허용이 필요하면 `pnpm-workspace.yaml`의 `allowBuilds`에 이유와 함께 추가한다
- pnpm의 최소 배포 기간 보호를 우회하지 않는다. `minimumReleaseAgeExclude`가 생기면 보호 기간을 통과한 버전으로 바꾼다
