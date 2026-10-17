# pray-everyday

"쌓이는 기도" 서비스를 만드는 모노리포다.

## 프로젝트 규칙

이 영역은 프로젝트가 직접 관리한다. 아래 design-harness 블록의 규칙에 더할 수는 있지만 뒤집지 않는다.

- `design/`의 요구사항과 아키텍처는 "쌓이는 기도" 서비스의 것이다. 서비스와 무관한 설계를 두지 않는다.
- 설계 관리는 외부 도구 design-harness의 규약 v1을 따른다. `design/harness/`, `design/harness.toml`, 아래 관리 블록은 그 설치본이며 이 저장소에서 고치지 않는다. 이 저장소는 design-harness를 개발하지 않는다.
- 규약이나 도구 자체가 불편하면 [design/harness-feedback.md](design/harness-feedback.md)에 남긴다. 서비스 설계와 구현 사이의 마찰은 `friction-log.md`에 남긴다. 둘을 섞지 않는다. 피드백을 남겼더라도 도구가 업데이트되기 전까지는 현재 규약을 따른다.
- 모노리포: pnpm workspace + Turborepo. 실행되는 애플리케이션은 `apps/`, 함께 쓰는 패키지는 `packages/`에 둔다.
- 명령: 설치 `pnpm install`, 전체 작업 `pnpm build` / `pnpm dev` / `pnpm lint` / `pnpm check-types` / `pnpm test` (Turborepo가 패키지별로 실행한다), 서식 `pnpm format`.
- 로컬 개발: `.env.example`을 `.env`로 복사하고 `docker compose up -d`로 PostgreSQL을 띄운 뒤 `pnpm dev`. 웹은 http://localhost:5173, 서버는 http://localhost:3000.
- API를 바꿀 때는 `packages/api-contract/openapi.yaml`을 먼저 고친다(D-10). 웹에는 비즈니스 로직과 DB 접근을 두지 않는다(D-09).
- TanStack Start는 릴리스가 잦다. 설정이나 API를 쓰기 전에 기억에 의존하지 말고 최신 문서를 확인한다.
- 의존성 설치 스크립트는 pnpm이 기본으로 막는다. 허용이 필요하면 `pnpm-workspace.yaml`의 `allowBuilds`에 이유와 함께 추가한다. 패키지가 배포하는 에이전트 skill(`pnpm approve`)은 사람의 승인 없이 승인하지 않는다.
- 의존성을 추가할 때 pnpm의 최소 배포 기간 보호를 우회하지 않는다. `minimumReleaseAgeExclude`가 생기면 보호 기간을 통과한 버전으로 바꾼다.
- (코딩 규칙 등은 정해지면 여기에 적는다)

<!-- design-harness:begin v1 -->
<!-- 이 블록은 design-harness가 관리한다. 직접 고치지 말고, 값은 design/harness.toml에서, 추가 규칙은 블록 밖에서 정한다. -->
## 설계 문서 규칙 (design-harness)

사람이 설계를 결정하고 에이전트가 구현한다. 설계에 충실하게 구현하되, 설계가 요구사항을 감당하지 못한다는 신호가 보이면 **우회하지 말고 멈춰서 보고한다.**
멈추는 것은 실패가 아니라 기대되는 행동이다. 설계에 맞지 않는 코드를 조용히 끼워 넣는 것이 실패다.

### 작업을 시작하기 전에

- `python3 design/harness/bin/check-design.py context <작업 경로>`를 실행하고, 출력된 `ARCHITECTURE.md`를 위에서부터 모두 읽는다. 상위 스코프의 규칙은 하위에도 적용되고, 하위 스코프는 규칙을 더할 수만 있다.
- 새로 받은 요구사항과 `미분석` 요구사항은 구현 전에 **적합 / 확장 / 재설계**로 분류하고 근거(`D-ID`)와 함께 보고한다. 재설계라면 구현하지 않고 `Proposed` ADR을 쓴다. 애매하면 더 무거운 쪽으로 분류한다.

### 무엇을 따르는가

- 구속력은 `ARCHITECTURE.md`와 `REQUIREMENTS.md`에만 있다. ADR은 이유의 기록이다. 둘이 다르면 `ARCHITECTURE.md`를 따르고 불일치를 보고한다.
- `Proposed` ADR을 근거로 구현하지 않는다. `archive/`는 읽지 않는다. 예외는 설계 변경을 제안하기 전에 기각 이력을 확인할 때뿐이다.
- "이행 중인 레거시"에 적힌 코드는 모방하지 않는다. 기존 코드의 패턴보다 `ARCHITECTURE.md`가 우선이다.
- 설계 결정과 요구사항을 에이전트 도구의 메모리 기능에 저장하지 않는다. 진실의 출처는 `design/` 문서뿐이다.

### 멈춤 신호

다음 중 하나라도 나타나면 우회 구현을 하지 말고 멈춘다.

- 불변식, 모듈 경계, 상위 스코프 규칙을 어겨야만 구현된다
- 특정 케이스만을 위한 분기, 플래그, 예외 처리를 끼워 넣게 된다
- 같은 상태를 두 곳 이상에 두고 동기화해야 한다
- 작은 기능인데 여러 모듈의 공개 인터페이스를 바꿔야 한다
- 테스트를 통과시키려고 테스트나 명세를 고치고 싶어진다
- `ARCHITECTURE.md`에 적힌 구조와 실제 코드가 이미 다르다

멈췄다면 충돌하는 `D-ID`, 우회안, 설계 변경안, 추천을 보고한다. 멈출 정도가 아닌 타협은 해당 스코프의 `friction-log.md`에 한 줄 남긴다.

### 결정 권한

- **에이전트가 결정해도 되는 것**: 모듈 내부 구현, 적합 또는 확장 수준의 변경, 리팩터링, 레거시 정리, archive 이동
- **에이전트는 제안만 하는 것**: ADR 승인과 기각, 데이터 모델과 저장소 스키마, 모듈 경계와 공개 인터페이스, 스코프 신설·삭제와 결정의 승격·강등, 보안과 권한, 되돌리기 어려운 결정

설계 변경이 승인되면 문서를 먼저 고치고 그다음 구현한다.

### 절차와 검증

- 설계 변경, 요구사항 변경, 스코프, ID, 정리 절차: [design/harness/README.md](design/harness/README.md)
- 커밋 전 검사가 pre-commit hook으로 실행된다. 클론한 뒤 `git config core.hooksPath .githooks`로 켠다. 검사를 우회해 커밋하지 않는다.
- 의미 있는 변경을 마치면 [design/harness/review-checklist.md](design/harness/review-checklist.md)로 설계 리뷰를 한다. 서브에이전트를 지원하는 도구라면 구현과 분리된 별도 에이전트로 실행한다(Claude Code: `design-reviewer`).
<!-- design-harness:end -->
