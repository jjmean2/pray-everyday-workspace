# ADR-0003: 웹 프레임워크, API 계약, 실행 환경

- **상태**: Accepted
- **날짜**: 2026-10-17
- **관련 요구사항**: R-015, R-025, R-026, R-027
- **대체하는 것**: 없음
- **제안 계기**: 사전 설계

## 요약

웹은 TanStack Start와 TanStack Query로 만들고, SPA 모드로 시작해 링크로 공유되는 페이지에만 라우트별 SSR을 켠다. API 계약은 OpenAPI 명세가 원본이고(명세 우선), 웹·서버·나중의 네이티브 앱이 모두 그 명세를 따른다. 로컬 개발은 Docker Compose로 PostgreSQL을 띄우고, 운영 DB는 관리형 PostgreSQL을 쓰는 방향이다.

## 맥락

대부분의 화면은 로그인 뒤에 있지만, permalink와 개인 기도방(R-025, R-026)은 카카오톡 같은 곳에 링크로 공유되고 미리보기가 떠야 한다. 순수 SPA는 경로마다 다른 메타 태그를 보낼 수 없다.
앱은 iOS와 Android 네이티브로 생각하고 있어서, API 계약은 TypeScript에 묶이지 않아야 한다. 사용자는 TanStack Query에 익숙하다.

## 결정

- **웹**: TanStack Start + TanStack Query. SPA 모드로 시작하고, 공유 페이지에 라우트별 SSR(`ssr` 옵션)을 켠다. Start의 server functions에는 비즈니스 로직을 두지 않고, SSR에 필요한 조회도 API 계약을 거쳐 NestJS를 부른다
- **API 계약**: `packages/api-contract`의 OpenAPI 명세가 원본이다. TypeScript 타입은 명세에서 생성하고, 네이티브 클라이언트도 같은 명세에서 생성한다. API를 바꿀 때는 명세를 먼저 고친다
- **개인 영역 API**: 첫 단계는 일반 API(자원별 요청)로 시작하되 D-06(클라이언트 생성 ID, 버전, 삭제 표시, 변경 순번)을 지킨다. 앱을 위한 동기화 API는 나중에 같은 명세에 더한다
- **실행 환경**: 로컬 개발은 Docker Compose로 PostgreSQL을 띄운다. 애플리케이션 Dockerfile은 애플리케이션을 만들 때 함께 만든다. 운영 DB는 관리형 PostgreSQL을 쓰는 방향이고, 배포 대상은 나중에 정한다

## 검토한 대안

- **React Router 8 (framework 모드)**: 가장 성숙하고 SPA 모드에서 SSR로 옮기기 쉽다. 하지만 SSR이 앱 전체 단위라 로그인 뒤 화면을 클라이언트 전용으로 만드는 처리가 따로 필요하고, TanStack Query 연동을 직접 해야 한다
- **Next.js**: NestJS가 이미 있어서 서버가 둘이 된다
- **코드 우선 OpenAPI (`@nestjs/swagger`)**: NestJS에서 흔하지만, 서버 코드를 고칠 때 계약이 조용히 바뀐다. 네이티브 클라이언트까지 생각하면 계약이 구현보다 먼저 있어야 한다
- **운영 DB도 컨테이너로**: 단순하지만 혼자서 백업과 복구를 운영해야 한다. 기도 기록은 잃으면 안 되는 데이터다
