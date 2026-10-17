# 아키텍처: design-harness

> 현재 유효한 설계만 적는다. 이력은 쓰지 않는다(ADR과 git에 있다).
> 이 문서와 루트 스코프의 ARCHITECTURE.md가 이 스코프에서 구속력을 가진 설계 문서다.

## 현재 상태

- **스코프**: `tools/design-harness`
- **상위 스코프**: `/`
- **결정 대기**:
  - [ADR-0002: CLI 중심 패키지로 분리](decisions/0002-cli-package.md)
  - [ADR-0003: 규약 버전, 업데이트, 마이그레이션](decisions/0003-versioning-and-update.md)
  - [ADR-0004: 도입 경로와 에이전트 어댑터](decisions/0004-adoption-and-adapters.md)
- **진행 중인 이행**: 없음
- **구현 위치**: 분리 전이라 구현은 pray-everyday의 [design/harness/](../../../design/harness/)에 있다. 이 스코프에는 설계 문서만 둔다.

## 범위

- **다루는 것**: 요구사항과 아키텍처를 발전시키는 설계 문서 규약, 그 규약을 검사하고 조작하는 도구, 에이전트에게 규약을 전달하는 방법(지시, 어댑터)
- **다루지 않는 것**: 규약을 쓰는 프로젝트의 설계 내용. 그 내용은 각 프로젝트가 소유한다

## 개요

design-harness는 사람이 설계를 결정하고 에이전트가 구현하는 프로젝트를 위한 **규약 + 도구**다.

- **규약**: 현재 상태 문서(구속력 있음)와 이력(구속력 없음)을 분리하고, 스코프 계층으로 범위를 나누고, 폐기된 것을 즉시 치우는 문서 체계
- **도구**: 규약 위반을 기계적으로 막는 검사기와, 작업 경로에 필요한 문서를 알려 주는 context 명령
- **전달**: 모든 에이전트가 읽는 `AGENTS.md`의 관리 블록과 평범한 Markdown 문서. 도구별 기능(서브에이전트 등)은 얇은 어댑터

역할 분담: **도구**는 결정적인 일(검증, 파일 조작)만 하고, **에이전트**는 내용 작성과 판단(영향 분석, 설계 제안)을, **사람**은 결정(승인, 기각)을 한다.

## 도메인 모델

| 개념 | 정의 | 표현 |
|---|---|---|
| 스코프 | `design/` 폴더를 가진 디렉터리. 루트 `design/`은 시스템 전체 | `<경로>/design/` |
| 요구사항 | 스코프가 충족해야 하는 기능 요구. 현재 유효한 것만 둔다 | `REQUIREMENTS.md`의 행, `R-NNN` |
| 현재 결정 | 지금 지켜야 하는 설계 결정과 그 가정, 한계, 재검토 트리거 | `ARCHITECTURE.md` 결정 표의 행, `D-NN` |
| ADR | 결정의 이유를 남긴 기록. 구속력 없음 | `decisions/NNNN-*.md`, `ADR-NNNN` |
| 마찰 | 설계와 어긋나 타협한 지점 중 아직 열린 것 | `friction-log.md`의 행 |
| 레거시 항목 | 코드에 남았지만 현재 설계가 아닌 것. 모방 금지 | `ARCHITECTURE.md` "이행 중인 레거시"의 행 |
| 관리 블록 | 공동 소유 파일 안에서 도구가 관리하는 구간 | `design-harness:begin vN` ~ `design-harness:end` |
| 하네스 설정 | 프로젝트의 규약 버전과 조정 값 | `design/harness.toml` |

ID(`R`, `D`, `ADR`)는 스코프 안에서 유일하고 재사용하지 않는다. 다른 스코프 참조는 `<경로>:<ID>`.

## 상태와 상태 전이

**ADR**

```
Proposed ──승인──▶ Accepted ──대체──▶ Superseded ─┐
    │                  │                          ├─▶ archive/decisions/
    └──기각──▶ Rejected ─┼──────────────────────────┘
                       └──근거에서 빠짐(squash)──▶ archive/decisions/
```

**요구사항**

- 상태: `제안` → `확정` → `구현됨`, 또는 `보류`. 폐기·대체되면 `archive/requirements.md`로 이동
- 설계 분류: `미분석` → `적합` / `확장` / `재설계`. 문구가 바뀌면 `미분석`으로 되돌린다

## 모듈과 경계

| 모듈 | 소유 | 책임 | 현재 위치 |
|---|---|---|---|
| 규약 문서 | 도구 | 절차, 소유권, 버전 규칙 | `design/harness/README.md` |
| 리뷰 체크리스트 | 도구 | 설계 정합성 리뷰 절차 | `design/harness/review-checklist.md` |
| 템플릿 | 도구 | ARCHITECTURE, REQUIREMENTS, ADR 양식 | `design/harness/templates/` |
| 검사기 | 도구 | `check`(정합성), `context <경로>`(스코프 체인과 확인할 항목) | `design/harness/bin/check-design.py` |
| 관리 블록 | 공동 | 항상 적용할 최소 규칙, hook 실행 | `AGENTS.md`, `.githooks/pre-commit` |
| 에이전트 어댑터 | 도구 | 도구별 기능으로 규약을 실행 | `.claude/agents/design-reviewer.md` |
| 하네스 설정 | 프로젝트 | 규약 버전, 임계값 | `design/harness.toml` |

의존 방향: 어댑터와 관리 블록 → 규약 문서와 검사기. 검사기는 프로젝트 문서를 읽기만 한다.

## 불변식

- 구속력 있는 문서는 각 스코프의 `ARCHITECTURE.md`와 `REQUIREMENTS.md`뿐이다
- `decisions/`에는 `Proposed`와 `Accepted`만 있고, `archive/`에는 `Proposed`가 없다
- `ARCHITECTURE.md`는 archive를 링크하지 않는다
- 현재 `REQUIREMENTS.md`에는 폐기·대체 상태가 없다
- `R`, `D`, `ADR` ID는 재사용하지 않는다
- 루트가 아닌 스코프는 루트 `ARCHITECTURE.md`의 스코프 목록에 등록돼 있다
- 공동 소유 파일에는 관리 블록이 정확히 하나 있고, 그 버전은 규약 버전과 같다
- 도구는 프로젝트 소유 파일의 내용을 판단해 쓰지 않는다. 명시적인 명령이나 규약 마이그레이션으로만 바꾼다

## 현재 유효한 결정

| ID | 결정 | 전제한 가정 | 수용하지 못하는 것 | 재검토 트리거 | 근거 |
|---|---|---|---|---|---|
| D-01 | 구속력은 현재 상태 문서(`ARCHITECTURE.md`, `REQUIREMENTS.md`)에만 두고, 이 문서는 이력 없이 다시 쓴다. ADR은 이유의 기록이다 | 에이전트가 작업 전에 현재 상태 문서를 읽는다 | ADR만으로 과거 시점의 규칙을 재구성하는 감사 | 현재 문서와 ADR의 불일치가 반복해서 발견될 때 | [ADR-0001](decisions/0001-baseline-convention-v1.md) |
| D-02 | 스코프는 `design/`을 가진 디렉터리다. 루트부터 작업 경로까지 체인으로 읽고, 하위는 상위 규칙을 뒤집지 않는다. 결정은 영향받는 가장 낮은 스코프에 둔다 | 디렉터리 계층이 설계 계층과 대체로 일치한다 | 디렉터리를 가로지르는 횡단 관심사 스코프 | 같은 규칙을 형제 스코프에 복제해야 하는 일이 생길 때 | [ADR-0001](decisions/0001-baseline-convention-v1.md) |
| D-03 | 대체·기각된 ADR과 폐기된 요구사항은 즉시 `archive/`로 옮기고, archive는 기본적으로 읽지 않는다. 남은 옛 코드는 "이행 중인 레거시"로 모방을 금지한다 | 이력이 필요한 경우는 기각 이력 확인과 원인 조사뿐이다 | archive 내용에 기대는 현재 규칙 | archive를 자주 읽어야 하는 작업이 반복될 때 | [ADR-0001](decisions/0001-baseline-convention-v1.md) |
| D-04 | 파일 소유권을 도구, 프로젝트, 공동으로 나누고, 공동 파일은 `begin`/`end` 관리 블록만 도구가 관리한다 | 프로젝트가 관리 블록 마커를 보존한다 | 관리 블록 내용의 프로젝트별 수정 | 블록 내용을 바꾸고 싶다는 요구가 반복될 때 | [ADR-0001](decisions/0001-baseline-convention-v1.md) |
| D-05 | 규약 버전을 `harness.toml`에 두고, 도구 버전과 관리 블록 버전이 같은지 검사한다 | 규약 변경이 정수 버전 하나로 표현된다 | 규약 일부만 선택적으로 채택하는 것 | 규약을 부분 채택하려는 요구가 생길 때 | [ADR-0001](decisions/0001-baseline-convention-v1.md) |
| D-06 | 규칙은 `AGENTS.md`와 평범한 Markdown으로 전달하고, 강제는 git hook으로 한다. 도구별 기능은 어댑터로만 둔다 | 대상 에이전트가 `AGENTS.md`를 읽는다 | `AGENTS.md`도 import도 읽지 않는 도구 | 지원하려는 에이전트가 `AGENTS.md`를 읽지 않을 때 | [ADR-0001](decisions/0001-baseline-convention-v1.md) |
| D-07 | 검사기는 구조만 검증하고, 의미의 정합성(코드와 문서의 일치 등)은 리뷰 체크리스트로 사람과 에이전트가 본다 | 구조 위반이 대부분의 혼란을 막는다 | 코드와 설계의 자동 정합성 검증 | 리뷰에서 같은 유형의 의미 위반이 반복될 때 | [ADR-0001](decisions/0001-baseline-convention-v1.md) |
| D-08 | 도구는 표준 라이브러리만 쓰는 Python 스크립트 하나(3.11 이상)로, 프로젝트 저장소 안 `design/harness/bin/`에 둔다 | 하네스를 이 저장소 하나에서만 쓴다 | 다른 프로젝트에 설치(R-008), 업데이트 반영(R-010), 기계적 문서 조작(R-012) | 다른 프로젝트에 적용하려 할 때 | [ADR-0001](decisions/0001-baseline-convention-v1.md) |

## 이행 중인 레거시

아직 코드에 남아 있지만 현재 설계가 아닌 것이다. **모방하지 않는다.** 정리가 끝나면 행을 지운다.

| 대상 (경로) | 대체한 결정 | 정리 방법 |
|---|---|---|
