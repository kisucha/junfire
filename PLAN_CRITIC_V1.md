# Critic Review — PLAN.md V1

| 항목 | 내용 |
|------|------|
| Document Name | PLAN.md V1 비판적 검토 보고서 |
| Version | V1 |
| Date | 2026-05-18 |
| Author | critic (claude-sonnet-4-6) |
| Document Type | 비판적 검토 보고서 |
| Model Used | claude-sonnet-4-6 |

---

## 심각도 분류

- CRITICAL: 구현 불가능하거나 보안/데이터 무결성 문제
- MAJOR: 모호함, 누락, 잘못된 설계로 구현 시 버그 발생 가능
- MINOR: 개선 권장, 미반영 시 운영 문제 가능성 있음

---

## 발견 문제 목록

---

### 1. `toKSTDateTime` 및 `calcTotalHours` 타임존 버그 — CRITICAL

- **위치:** PLAN.md 단계 4 (`src/lib/utils/time.ts`)
- **문제:** `calcTotalHours`와 `toKSTDateTime` 두 함수 모두 `new Date(`${dateStr}T00:00:00+09:00`)` 로 KST 기준 베이스를 만든 뒤 즉시 `setHours(h, m, 0, 0)`를 호출한다. `setHours`는 JavaScript 런타임의 **로컬 타임존** 기준으로 동작하므로, 운영 Linux 서버가 UTC 타임존으로 설정된 경우(일반적인 서버 환경) 시각이 9시간 어긋난다. 예: `setHours(22, 0)` 실행 시 서버 로컬(UTC) 22:00이 저장되어 KST 07:00 다음날이 되는 오류가 발생한다. 야간 근무 판단 조건 `endTime <= startTime`도 동일 문제로 잘못된 결과를 낼 수 있다.
- **영향:** 전체 근무시간 계산 오류. 야간 근무 처리 실패. totalHours 음수 또는 비정상값 저장. DB의 startTime/endTime DateTime 값 오류. 소방 업종의 야간 출동 기록이 전면 오염됨.
- **개선 방향:** `setHours` 대신 타임존을 명시적으로 처리해야 한다. `date-fns-tz`의 `zonedTimeToUtc` 또는 `new Date(`${dateStr}T${timeStr}:00+09:00`)`처럼 ISO 8601 문자열에 오프셋을 직접 포함하는 방식으로 변환해야 한다. 두 함수 모두 수정 필요.

---

### 2. `yearMonth` 필터 상단 경계 계산 버그 — CRITICAL

- **위치:** PLAN.md 단계 5 (`src/app/api/records/route.ts`, GET 핸들러, 998~1000줄)
- **문제:** 다음과 같이 작성되어 있다:
  ```
  gte: new Date(`${yearMonth}-01T00:00:00+09:00`),
  lt: new Date(`${yearMonth}-01T00:00:00+09:00`).toISOString()
  ```
  `lt` 값이 `gte` 값과 **동일**하다. 주석에 "다음 달 1일까지 범위 조회는 getServerSession에서 처리"라고 적혀 있으나 `getServerSession`은 범위를 계산하는 함수가 아니며, 실제 다음 달 날짜 계산 로직이 완전히 빠져 있다. 이 상태로 구현하면 달력 데이터가 전혀 조회되지 않는다.
- **영향:** 직원 대시보드 달력이 항상 빈 화면을 표시한다. 핵심 기능 전면 불동작.
- **개선 방향:** `date-fns`의 `addMonths`를 사용해 `nextMonth = addMonths(new Date(`${yearMonth}-01`), 1)` 계산 후 lt 조건에 사용해야 한다. 또는 `${yearMonth}-01T00:00:00+09:00`을 파싱 후 +1개월 처리 로직을 명시해야 한다.

---

### 3. Prisma 에러 감지 패턴 불안정 — CRITICAL

- **위치:** PLAN.md 단계 5 (`src/app/api/records/route.ts` POST, 1074줄)
- **문제:** UNIQUE 제약 위반 감지를 `error.message.includes('Unique constraint')` 문자열 비교로 처리한다. Prisma는 UNIQUE 위반 시 `PrismaClientKnownRequestError` 인스턴스를 던지며 `code` 프로퍼티 값이 `'P2002'`로 표준화되어 있다. 메시지 문자열은 Prisma 버전에 따라 변경될 수 있으며, 문자열 비교는 다른 에러를 409로 오판할 수 있다.
- **영향:** 중복 기록 시 409 대신 500 에러가 반환될 수 있음. 또는 전혀 다른 에러를 중복 기록 에러로 오인. EC-002 엣지 케이스 처리 실패.
- **개선 방향:** `import { Prisma } from '@prisma/client'` 후 `error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'`로 감지해야 한다. override API 등 다른 catch 블록에도 동일 패턴 적용 필요.

---

### 4. `@db.Date` 미선언으로 date 필드 타임존 문제 — MAJOR

- **위치:** PLAN.md 단계 2 (`prisma/schema.prisma`, WorkRecord.date 및 Holiday.date)
- **문제:** WorkRecord의 `date` 필드와 Holiday의 `date` 필드가 `DateTime`으로 선언되어 있으나 `@db.Date` 어노테이션이 없다. PostgreSQL의 `timestamp` 타입으로 생성되므로 시각 정보(T00:00:00)가 포함되어 UTC로 저장된다. KST 기준 날짜 비교 쿼리 시 00:00:00 UTC = KST 09:00이 되어 날짜 경계가 어긋난다. RESEARCH.md 섹션 5.2에서 "date 필드: Asia/Seoul 기준 날짜만 저장 (PostgreSQL Date 타입)"으로 명확히 요구되어 있다. 인덱스 전략 표에서도 "Date 타입"이라고 명시하고 있어 스키마 선언과 모순된다.
- **영향:** `@@unique([userId, date])` 제약에서 동일 날짜가 다른 UTC 시각으로 두 번 저장될 수 있음. Holiday 달력 표시 오류. KST 날짜 필터 쿼리 결과 불일치.
- **개선 방향:** `date DateTime @db.Date`로 변경해야 한다. 단, Prisma에서 `@db.Date`를 사용하면 해당 필드는 `Date` 객체의 날짜 부분만 저장하므로 이에 맞게 쿼리를 조정해야 한다.

---

### 5. cursor 페이징과 orderBy 비호환 — MAJOR

- **위치:** PLAN.md 단계 4 (`src/lib/utils/pagination.ts`) + 단계 5 각 API
- **문제:** `buildCursorQuery`는 항상 `cursor: { id: cursor }`로 고정 설정한다. 그러나 Prisma cursor 기반 페이징은 **`orderBy` 필드와 `cursor` 필드가 일치**해야 정확히 동작한다. 아래 두 케이스에서 불일치가 발생한다:
  - `GET /api/admin/staff`: `orderBy: { name: 'asc' }`이지만 cursor는 `id`. `name` 정렬에서 `id` cursor를 사용하면 Prisma가 cursor 위치를 `name` 정렬 순서상 올바르게 계산하지 못해 데이터 누락 또는 중복이 발생한다.
  - `GET /api/admin/records`: `orderBy: [{ date: 'asc' }, { userId: 'asc' }]` 복합 정렬에서 `id` cursor 사용 시 동일 문제.
- **영향:** 직원 목록 Load More 시 일부 직원이 누락되거나 중복 노출. 관리자 기록 조회 페이징 데이터 신뢰 불가. 페이징 요구사항(offset 절대 금지)이 실질적으로 위반됨.
- **개선 방향:** cursor로 사용할 필드가 `orderBy`와 일치해야 한다. 두 가지 접근 방식 중 하나를 선택해야 한다. (1) 모든 API의 `orderBy`를 `id` 기준으로 변경하거나, (2) `buildCursorQuery`를 개선하여 호출 측에서 cursor 필드명을 지정하도록 수정. staff API는 `name` 정렬이 중요하므로 cursor 필드 전략을 재설계해야 한다. 실용적 대안으로 CUID id는 생성 순서 정렬이 가능하므로 `orderBy: { createdAt: 'asc' }` + cursor `{ id }` 조합이나, `take`가 충분히 크면(5명) 전체 로드 후 클라이언트 정렬도 고려 가능.

---

### 6. `GET /api/records` cursor 페이징 + yearMonth 필터 동시 사용 시 orderBy 비일관성 — MAJOR

- **위치:** PLAN.md 단계 5 (`src/app/api/records/route.ts` GET, 1004줄)
- **문제:** `orderBy: { date: 'desc' }`로 정렬하면서 cursor는 `id`를 사용한다. 문제 5와 동일한 cursor/orderBy 비호환 이슈. 달력 데이터를 날짜 내림차순으로 가져올 때 cursor가 `id` 기준이므로 페이지 경계에서 날짜 기록이 누락될 수 있다. 달력 특성상 한 달에 최대 31건이므로 `take: 31`로 전체 로드하면 실용적으로는 문제없을 수 있으나, 구조적 불일치가 명시적 해결 없이 방치되어 있다.
- **영향:** 달력 기록 일부 누락 가능성. 특히 기록이 많은 경우(소급 입력 등) 페이지 경계에서 데이터 손실.
- **개선 방향:** 달력 조회는 `take: 31` + cursor 없이 전체 로드하거나, `orderBy: { id: 'asc' }`로 변경하고 클라이언트에서 날짜 기준 재정렬하는 방식으로 명시해야 한다.

---

### 7. WORK 미래 날짜 체크가 UTC 기준 — MAJOR

- **위치:** PLAN.md 단계 5 (`src/app/api/records/route.ts` POST, 1028줄)
- **문제:** `date > new Date().toISOString().slice(0, 10)`은 서버 기준 UTC 날짜를 비교한다. KST는 UTC+9이므로 KST 기준 오늘(예: 2026-05-18)이 UTC에서는 아직 2026-05-17인 경우(오전 9시 이전), KST에서 "오늘" 날짜가 UTC 기준으로는 "내일"로 간주되어 WORK 기록이 차단된다. RESEARCH.md에서 타임존은 명확히 Asia/Seoul로 요구되어 있다.
- **영향:** 오전 9시 이전 사용자가 당일 WORK 기록을 입력하면 422 에러. BR-007 처리 오작동.
- **개선 방향:** `getTodayKST()` 유틸(이미 `src/lib/utils/date.ts`에 정의됨)을 사용하여 `date > getTodayKST()`로 비교해야 한다.

---

### 8. `/api/password` 라우트 구현 스니펫 완전 누락 — MAJOR

- **위치:** PLAN.md 단계 5
- **문제:** 단계 5 수정/생성 파일 목록에 `src/app/api/password/route.ts`가 포함되어 있고 API 테이블에 `PUT /api/password`가 정의되어 있으나, 해당 라우트의 구현 접근 방식, 코드 스니펫이 전혀 없다. 이 API는 isFirstLogin=false 업데이트, 비밀번호 정책 재검증, 현재 비밀번호 확인 여부 등 중요한 보안 로직을 포함해야 한다.
- **영향:** 구현자가 isFirstLogin 업데이트 로직을 누락할 위험. 현재 비밀번호 없이 변경 가능한 보안 취약점 발생 가능성. `change-password` 페이지 흐름 자체가 동작 불가.
- **개선 방향:** `src/app/api/password/route.ts` PUT 핸들러의 구현 스니펫 추가 필요. 최소 포함 사항: (1) 현재 비밀번호 검증, (2) 새 비밀번호 정책 검증, (3) bcrypt hash 후 저장, (4) isFirstLogin=false 업데이트.

---

### 9. `/api/records/[id]` PUT/DELETE 구현 스니펫 누락 — MAJOR

- **위치:** PLAN.md 단계 5
- **문제:** `src/app/api/records/[id]/route.ts`가 파일 목록에 있고 API 테이블에 GET/PUT/DELETE가 정의되어 있으나 코드 스니펫이 전혀 없다. 특히 PUT/DELETE에서 소유자 검증(BR-009, BR-010) 패턴이 명시되지 않아 구현자가 빠뜨릴 위험이 높다.
- **영향:** 소유자 검증 누락 시 EMPLOYEE가 타인 기록 수정/삭제 가능한 보안 취약점. RESEARCH.md BR-009, BR-010 위반.
- **개선 방향:** 최소한 소유자 검증 패턴(`prisma.workRecord.findFirst({ where: { id, userId: session.user.id } })` → null이면 403)을 포함한 스니펫 추가 필요.

---

### 10. `/api/admin/report` 라우트 구현 스니펫 누락 — MAJOR

- **위치:** PLAN.md 단계 7
- **문제:** `generateReport.ts` 와 `ReportDocument.tsx` 구현 스니펫은 있으나, 이를 호출하는 `src/app/api/admin/report/route.ts` POST 핸들러 스니펫이 없다. PDF Buffer를 HTTP 응답으로 반환하는 방법(Content-Type, Content-Disposition, Next.js Response 객체 사용)이 명시되지 않았다.
- **영향:** PDF 다운로드 API의 응답 형식 불명확. 구현자가 일반 JSON 응답 방식으로 잘못 구현할 위험. 파일명 지정 방법(`JunFire_{YYYY-MM}_report.pdf`) 미명시.
- **개선 방향:** POST 핸들러에서 `generateReport` 호출 후 `new Response(pdfBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="JunFire_report.pdf"` } })`를 반환하는 패턴 명시 필요.

---

### 11. `standalone` 빌드 시 `public` 폴더 수동 복사 지침 누락 — MAJOR

- **위치:** PLAN.md 단계 8 (배포 설정)
- **문제:** Next.js `output: 'standalone'` 빌드는 `.next/standalone` 디렉토리를 생성하지만 `public` 폴더와 `.next/static` 폴더를 **자동으로 복사하지 않는다**. 개발자가 수동으로 복사해야 한다. `NotoSansKR-Regular.ttf`가 `public/fonts/`에 있으므로, 이 파일이 standalone 디렉토리에 없으면 PDF 생성 시 폰트 파일을 찾지 못해 한글 깨짐이 발생한다. 배포 체크리스트에도 이 항목이 없다.
- **영향:** 운영 환경에서 PDF 한글 깨짐. RS-001 리스크 현실화. `_next/static` 미복사 시 정적 파일(CSS, JS) 404 오류로 UI 전체 불동작.
- **개선 방향:** 배포 프로세스에 아래 명령어 추가 필요:
  ```
  cp -r public .next/standalone/public
  cp -r .next/static .next/standalone/.next/static
  ```
  배포 체크리스트에도 별도 항목 추가 필요.

---

### 12. PM2 `env_file` 미설정 — MAJOR

- **위치:** PLAN.md 단계 8 (`ecosystem.config.js`)
- **문제:** PM2 설정에서 `env` 블록에 `NODE_ENV`와 `PORT`만 있다. `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` 등 필수 환경변수가 없다. Next.js standalone 빌드는 `.env` 파일을 자동으로 로드하지 않으므로 환경변수가 PM2에 명시적으로 주입되지 않으면 DB 연결 실패, NextAuth 동작 불능이 된다.
- **영향:** 운영 서버 시작 시 Prisma DB 연결 오류. NEXTAUTH_SECRET 없이 세션 생성 실패. 시스템 전면 불동작.
- **개선 방향:** `ecosystem.config.js`에 `env_file: '.env'` 옵션을 추가하거나, `env` 블록에 `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` 환경변수 주입 방법을 명시해야 한다. 또는 배포 지침에 `export $(cat .env)` 방식을 명시해야 한다.

---

### 13. BR-002 `totalHours > 0` 서버사이드 검증 누락 — MAJOR

- **위치:** PLAN.md 단계 5 (records POST, override POST)
- **문제:** RESEARCH.md BR-002에서 "WORK 상태: totalHours > 0 서버사이드 계산 후 검증"을 명시하고 있으나, PLAN.md 구현 스니펫에서 `calcTotalHours` 호출 후 결과에 대한 양수 검증이 없다. 만약 `startTime == endTime`이면 totalHours = 0이 저장된다. 실제 문제 1(타임존 버그)이 해결된 후에도 동일 시각 입력 시 0이 저장될 수 있다.
- **영향:** 0시간 또는 음수 근무시간이 DB에 저장될 수 있음. 집계 결과 오염. BR-002 미준수.
- **개선 방향:** `totalHours` 계산 후 `if (totalHours <= 0) { return 400 에러 }` 검증 추가 필요.

---

### 14. ReportTable Load More에 날짜 필터 파라미터 누락 — MAJOR

- **위치:** PLAN.md 단계 6 (`ReportTable.tsx`, 1426줄)
- **문제:** Load More 요청 URL이 `/api/admin/records?cursor=${nextCursor}&take=50`이다. 초기 조회 시 적용된 `startDate`, `endDate`, `includeInactive` 파라미터가 Load More 요청에서 완전히 빠져 있다. 두 번째 페이지부터는 날짜 필터 없이 전체 레코드를 조회하게 된다.
- **영향:** 특정 기간 조회 후 Load More 클릭 시 다른 기간 데이터가 혼입됨. 관리자 보고서 데이터 신뢰도 전면 붕괴.
- **개선 방향:** Load More 요청에 `startDate`, `endDate`, `includeInactive` 파라미터를 state로 유지하며 포함해야 한다. 또는 PDF 생성용 데이터는 서버에서 전체 로드 후 페이지네이션 없이 처리하는 방식도 검토 가능.

---

### 15. Nginx `/_next/static` 정적 파일 캐시 설정 누락 — MINOR

- **위치:** PLAN.md 단계 8 (`nginx.conf`)
- **문제:** Nginx 설정에 `/_next/static` 정적 파일에 대한 별도 캐시 헤더 설정이 없다. Next.js `standalone` 빌드에서 정적 자산은 Nginx를 통해 직접 서빙하는 것이 성능에 좋으나, 현재 설정은 모든 요청을 Next.js 서버로 프록시한다. 이는 소규모에서는 기능적으로 문제없지만 성능 최적화 기회를 놓친다.
- **영향:** 정적 파일(CSS, JS, 이미지)이 매번 Next.js 서버를 거쳐 응답. 응답 지연 가능성.
- **개선 방향:** Nginx에 아래 블록 추가 권장:
  ```
  location /_next/static/ {
      alias /opt/junfire/.next/standalone/.next/static/;
      expires 1y;
      add_header Cache-Control "public, immutable";
  }
  ```

---

### 16. `Prisma.PrismaClientKnownRequestError` import 없이 스니펫 작성됨 — MINOR

- **위치:** PLAN.md 단계 5 각 API 스니펫
- **문제:** 문제 3에서 지적한 에러 처리 개선 방향에서 `Prisma` import가 필요하나, 현재 스니펫에 해당 import가 없다. 또한 `GET /api/admin/staff` 스니펫에 import 문 자체가 전혀 없어 `buildCursorQuery`, `prisma`, `getServerSession` 등 의존성이 불분명하다.
- **영향:** 구현자가 import를 누락할 위험. 타입 오류 발생 가능.
- **개선 방향:** 모든 API 스니펫에 필요한 import 문을 명시하거나, 최소한 "공통 import 패턴" 섹션에 Prisma 에러 타입 import를 추가해야 한다.

---

### 17. 랜딩 페이지 로그인 상태 리다이렉트 구현 방법 미명시 — MINOR

- **위치:** PLAN.md 단계 6 (UI 컴포넌트)
- **문제:** RESEARCH.md 섹션 6.1에서 "로그인된 EMPLOYEE → /dashboard 자동 리다이렉트, 로그인된 ADMIN → /admin 자동 리다이렉트"를 요구하고 있으나, PLAN.md에서 랜딩 페이지(`src/app/page.tsx`) 구현 방법이 전혀 없다. middleware matcher에도 `/` (루트 경로)가 포함되어 있지 않아 미들웨어로 처리할 수 없다. 서버 컴포넌트에서 `getServerSession` 후 `redirect()`를 호출하는 패턴인지 불명확하다.
- **영향:** 구현자가 로그인 상태 리다이렉트 로직을 누락하면 이미 로그인한 사용자가 랜딩 페이지에 머물게 됨.
- **개선 방향:** `src/app/page.tsx`를 서버 컴포넌트로 작성하여 `getServerSession` 결과에 따라 `redirect('/dashboard')` 또는 `redirect('/admin')`를 호출하는 접근 방식을 명시해야 한다.

---

### 18. 보고서 페이징 필요성 논의 누락 — MINOR

- **위치:** PLAN.md 단계 6 (ReportTable), 단계 7 (generateReport)
- **문제:** 관리자 대시보드 보고서 테이블(`ReportTable.tsx`)은 cursor 기반 Load More를 사용하지만, PDF 생성(`generateReport.ts`)은 전체 데이터를 한 번에 조회한다. 두 접근 방식의 트레이드오프(보고서 테이블에서 페이징 vs 전체 로드)가 전혀 논의되지 않았다. 특히 PDF 생성은 전체 로드가 맞지만, 화면 보고서 테이블의 커서 페이징은 날짜 필터 범위가 작을 경우 불필요하고, 필터 상태 유지 문제(문제 14)와 결합하면 설계 일관성이 무너진다.
- **영향:** 설계 의도 불명확. 구현자가 최적 전략 선택에 혼선.
- **개선 방향:** "관리자 보고서는 날짜 범위 기준 전체 로드(페이징 없음) + PDF 생성과 동일 쿼리 재사용" 또는 "일정 건수 이상 시 Load More" 중 선택 근거를 명시해야 한다.

---

## NF-001~004 반영 확인

| 항목 | 반영 여부 | 비고 |
|------|---------|------|
| NF-001 | ✅ | `/api/admin/records/override` POST + `/admin/records/[userId]/[date]` 페이지 경로 명시됨. 미완료 항목(5번)으로도 별도 기재. |
| NF-002 | ✅ | ADMIN 본인 기록은 기존 `/api/records/*` 재사용으로 명시됨. 트레이드오프 표에서도 확인. |
| NF-003 | ✅ | `generateReport.ts`에서 Holiday 테이블 별도 조회 후 `holidayMap` 생성, `buildDetailRows`에서 공휴일 행 추가 로직 구체적으로 명시됨. |
| NF-004 | ✅ | `RoleLabel` 상수 정의 (`types/index.ts`), `getRoleLabel` 함수, PDF 직원 헤더에 적용까지 명시됨. |

---

## 총평

**발견 문제 수: CRITICAL 3 / MAJOR 11 / MINOR 4**

**현재 완성도 평가: 약 62%**

PLAN.md는 전체 디렉토리 구조, 핵심 API 설계 의도, Prisma 스키마 구조, PDF 생성 로직, NF-001~004 반영 등에서 기반 설계는 충실하다. 그러나 다음 세 가지 범주에서 중대한 결함이 발견되었다.

**주요 보완 영역:**

1. **타임존 처리 전면 재검토 (CRITICAL 1, 2, MAJOR 5, 6):** `setHours`를 사용하는 모든 시간 계산 함수와 UTC 기반 날짜 비교를 KST 명시적 처리로 교체해야 한다. 이것이 해결되지 않으면 근무 기록 시간이 전면 오염된다.

2. **누락된 API 구현 스니펫 (MAJOR 8, 9, 10):** `/api/password`, `/api/records/[id]`, `/api/admin/report` 세 라우트는 파일 목록에만 있고 구현 상세가 전혀 없다. 특히 소유자 검증과 PDF Buffer 반환 방식은 보안/기능 측면에서 반드시 명시되어야 한다.

3. **배포 환경 준비 사항 (MAJOR 11, 12):** standalone 빌드 시 public 폴더 수동 복사와 PM2 환경변수 주입 방법이 없으면 운영 환경에서 시스템이 즉시 불동작한다. 이는 구현 후 배포 시 가장 먼저 맞닥뜨릴 문제이다.

---

*Critic Review V1 완료: 2026-05-18*
*검토 기반: PLAN.md V1, RESEARCH.md V2, CRITIC_REVIEW_V2.md NF-001~004*
