# pray-everyday

"쌓이는 기도" 서비스를 만드는 모노리포다.

## 프로젝트 규칙

이 영역은 프로젝트가 직접 관리한다. 아래 design-harness 블록의 규칙에 더할 수는 있지만 뒤집지 않는다.

- `architecture/`의 요구사항, 아키텍처, 컨벤션은 "쌓이는 기도" 서비스의 것이다. 서비스와 무관한 설계를 두지 않는다.
- 설계 관리는 외부 도구 design-harness(문서 버전 0.1)를 따른다. 이 저장소는 design-harness를 개발하지 않는다. `architecture/harness/`와 아래 관리 블록은 부트스트랩한 구조라 고쳐도 되지만, 규약 자체가 불편하면 고치기 전에 [architecture/harness-feedback.md](architecture/harness-feedback.md)에 남긴다. 서비스 설계와 구현 사이의 타협은 `architecture/notes/architecture.md`에 `[타협]`으로 남긴다. 둘을 섞지 않는다.
- 0.x 동안 design-harness의 깨지는 변경은 이 저장소에서 직접 고친다.
- 명령: 설치 `pnpm install`, 전체 작업 `pnpm build` / `pnpm dev` / `pnpm lint` / `pnpm check-types` / `pnpm test` (Turborepo가 패키지별로 실행한다), 서식 `pnpm format`.
- 로컬 개발: `.env.example`을 `.env`로 복사하고 `docker compose up -d`로 PostgreSQL을 띄운 뒤 `pnpm dev`. 웹은 http://localhost:6102(고정. 쓰고 있으면 실패한다), 서버는 http://localhost:3000.
- 구현 규칙(API 명세 우선, 웹의 책임, 의존성 정책)은 `architecture/CONVENTIONS.md`를 따른다.
- TanStack Start는 릴리스가 잦다. 설정이나 API를 쓰기 전에 기억에 의존하지 말고 최신 문서를 확인한다.
- 패키지가 배포하는 에이전트 skill(`pnpm approve`)은 사람의 승인 없이 승인하지 않는다.

<!-- design-harness:begin v0.1 -->
<!-- 이 블록은 design-harness가 들여놓았다. 마커는 남기고, 값은 design-harness.toml에서, 추가 규칙은 블록 밖에서 정한다. upgrade가 새 판의 변경을 합친다. -->
## 설계 문서 규칙 (design-harness)

사람이 설계를 결정하고 에이전트가 구현한다. 설계에 충실하게 구현하되, 설계가 요구사항을 감당하지 못한다는 신호가 보이면 **우회하지 말고 멈춰서 보고한다.**
멈추는 것은 실패가 아니라 기대되는 행동이다. 설계에 맞지 않는 코드를 조용히 끼워 넣는 것이 실패다.

설계 문서는 각 스코프의 `architecture/`에 있다.

- **현재 상태 문서**: `REQUIREMENTS.md`(무엇이 필요한가), `ARCHITECTURE.md`(어떻게 생겼나), `CONVENTIONS.md`(구현할 때 지킬 규칙). **구속력은 여기에만 있다**
- **notes/**: 요구사항, 아키텍처, 컨벤션을 정하는 동안의 작업 메모. 구속력이 없다
- **ADR**(`decisions/`): 결정의 이유. 불변이다. archive는 같은 제안을 다시 꺼내기 전에만 본다

### 구현하는 일

- 시작 전에 `design-harness context <작업 경로>`를 실행하고, 출력된 현재 상태 문서를 상위부터 모두 읽는다. 상위 스코프의 규칙은 하위에도 적용되고, 하위는 더할 수만 있다
- 현재 상태 문서만 따른다. notes와 archive는 구현의 근거가 아니다. "이행 중인 레거시"에 적힌 코드는 모방하지 않는다
- 멈출 정도는 아닌 타협을 했다면 그 스코프의 `notes/architecture.md`에 `[타협]`으로 관련 설계 절을 링크해 남긴다

### 정하는 일 (요구사항, 아키텍처, 컨벤션을 쓰거나 고칠 때)

- `design-harness context --notes <경로>`로 notes까지 읽는다. 받은 요구와 정하는 중인 것은 notes에 적는다
- 새 요구나 바뀐 요구는 그 요구를 링크하는 설계 절("감당하는 요구")의 "가정과 한계"와 대조해 **적합 / 확장 / 재설계**로 분류하고 근거와 함께 보고한다. 애매하면 더 무거운 쪽으로 분류한다
- 적합과 확장은 현재 상태 문서를 고치고 진행한다. 재설계는 사람이 정할 때까지 구현하지 않는다
- 정해지면 현재 상태 문서를 먼저 고치고 구현한다. 결정 이유를 다시 보고 싶을 결정은 `design-harness adr new`로 ADR을 남긴다. 반영한 notes 항목은 지운다
- 문서끼리, 또는 문서와 코드가 다른 말을 하면(불일치) 추측하지 않는다. 깨진 링크나 근거가 분명한 반영 누락은 바로 고치고, 결정이 필요한 것은 충돌하는 자리에 `불일치 (결정 필요)` 표시를 남기고 보고한다. 우선순위와 절차는 규약 문서의 "불일치" 절에 있다

### 멈춤 신호

다음 중 하나라도 나타나면 우회 구현을 하지 말고 멈춘다.

- 현재 상태 문서가 정하지 않은 설계 판단을 해야만 구현된다
- 불변식, 모듈 경계, 컨벤션, 상위 스코프 규칙을 어겨야만 구현된다
- 특정 케이스만을 위한 분기, 플래그, 예외 처리를 끼워 넣게 된다
- 같은 상태를 두 곳 이상에 두고 동기화해야 한다
- 작은 기능인데 여러 모듈의 공개 인터페이스를 바꿔야 한다
- 테스트를 통과시키려고 테스트나 명세를 고치고 싶어진다
- 현재 상태 문서에 적힌 구조와 실제 코드가 이미 다르다
- 현재 상태 문서끼리 서로 다른 말을 하거나, `불일치 (결정 필요)` 표시가 있는 부분에 기대야만 구현된다

멈췄다면 걸린 신호, 충돌하는 설계 절이나 컨벤션, 우회안, 설계 변경안, 추천을 보고한다.

### 결정 권한

- **에이전트가 결정해도 되는 것**: 모듈 내부 구현, 적합 또는 확장 수준의 문서 갱신, 리팩터링, 레거시 정리, 작은 컨벤션 보완(이유는 커밋 메시지에)
- **에이전트는 제안만 하는 것**: 재설계, ADR로 남길 결정, 데이터 모델과 저장소 스키마, 모듈 경계와 공개 인터페이스, 스코프 신설과 삭제, 보안과 권한, 되돌리기 어려운 결정
- 설계 결정과 요구사항을 에이전트 도구의 메모리 기능에 저장하지 않는다. 기억할 것은 notes에 둔다

### 절차와 검증

- 문서 쓰는 법, notes, ADR, 스코프, 버전: [architecture/harness/README.md](architecture/harness/README.md)
- 커밋 전 검사가 pre-commit hook으로 실행된다. 클론한 뒤 `git config core.hooksPath .githooks`로 켜고, `design-harness`를 설치한다(설치 방법은 규약 문서). 검사를 우회해 커밋하지 않는다.
- 의미 있는 변경을 마치면 [architecture/harness/review-checklist.md](architecture/harness/review-checklist.md)로 설계 리뷰를 한다. 서브에이전트를 지원하는 도구라면 구현과 분리된 별도 에이전트로 실행한다(Claude Code: `design-reviewer`).
- 큰 설계 변경 뒤, `check`의 안내가 쌓였을 때, `check`가 감사 기한을 알릴 때 [architecture/harness/audit-checklist.md](architecture/harness/audit-checklist.md)로 정합성 감사를 한다.
<!-- design-harness:end -->
