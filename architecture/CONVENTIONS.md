# 컨벤션: 쌓이는 기도 (시스템 전체)

구현할 때 지킬 설계 수준의 규칙을 현재 상태로 적는다. 바뀌면 고쳐 쓰고, 이력은 git에 둔다.
lint와 formatter로 강제할 수 있는 규칙은 그 도구에 두고, 에이전트의 작업 절차는 `AGENTS.md`에 둔다. 하위 스코프는 상위 규칙에 더하기만 한다.

## 저장소 구성

- 실행되는 애플리케이션은 `apps/`, 함께 쓰는 패키지는 `packages/`에 둔다
- 웹과 서버가 함께 쓰는 도메인 규칙은 `packages/domain`에 둔다

## API와 웹

- API를 바꿀 때는 `packages/api-contract/openapi.yaml`을 먼저 고치고, 생성된 타입으로 서버와 웹을 구현한다. 이유: [ADR-0003](decisions/0003-web-framework-api-contract-runtime.md)
- 요청과 응답의 검사는 명세가 한다. 컨트롤러에 명세의 규칙을 다시 적은 검사 코드나 DTO 검증을 두지 않고, 명세의 타입을 그대로 받는다. 명세보다 좁은 규칙이 필요하면 명세를 고친다. 이유: [ADR-0006](decisions/0006-api-요청과-응답을-명세로-실행-중에-검사.md)
- 명세의 모든 엔드포인트는 따로 적지 않은 오류를 `default` 응답(`#/components/responses/Error`)으로 선언한다
- API의 오류 응답은 RFC 9457 Problem Details(`application/problem+json`, `type`, `title`, `status`, `detail`)로 돌려준다. 명세의 모든 오류 응답이 같은 스키마를 쓴다
- 개발과 테스트에서만 쓰는 엔드포인트는 명세에 `x-dev-only: true`를 붙인다. 꺼져 있을 때는 컨트롤러와 명세 검사기 모두에 등록하지 않아, 본문이 틀려도 404다
- TanStack Start의 server functions에는 비즈니스 로직을 두지 않는다. SSR에 필요한 조회도 API 계약을 거쳐 서버를 부른다. 클라이언트와 서버의 책임은 [영역과 모듈의 경계](ARCHITECTURE.md#영역과-모듈의-경계)를 따른다. 이유: [ADR-0003](decisions/0003-web-framework-api-contract-runtime.md)

## 서버 실행 환경

미리보기는 서버리스(Vercel 함수)로, 운영은 상시 실행 서버로 옮길 수 있게 서버 코드는 양쪽에서 돌게 쓴다. 이유: [ADR-0008](decisions/0008-미리보기-배포를-vercel과-neon의-무료-등급으로.md)

- 요청 사이의 상태를 메모리에 두지 않는다. 세션처럼 이어지는 상태는 DB에 둔다
- 응답을 보낸 뒤 백그라운드 작업을 돌리지 않는다. 필요하면 요청 안에서 끝내거나 예약 작업으로 둔다
- 연결을 붙잡는 기능(WebSocket, SSE)을 서버에 두지 않는다. 실시간 알림이 필요해지면 "바뀌었다"는 신호만 따로 보내고, 데이터는 클라이언트가 API로 가져오게 한다
- 환경마다 다른 값은 환경 변수로 받고, 플랫폼 전용 코드는 진입점과 배포 설정에만 둔다

## 의존성

- 의존성 설치 스크립트는 pnpm이 기본으로 막는다. 허용이 필요하면 `pnpm-workspace.yaml`의 `allowBuilds`에 이유와 함께 추가한다
- pnpm의 최소 배포 기간 보호를 우회하지 않는다. `minimumReleaseAgeExclude`가 생기면 보호 기간을 통과한 버전으로 바꾼다
