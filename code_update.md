# 변경 이력 로그 — JunFire Protection

---

## 2026-06-04

### 업무내용 제공 메뉴 신규 추가 + 직원 공휴일 상태 허용

**변경 파일**

| 파일 | 구분 | 내용 |
|------|------|------|
| `src/app/api/records/my-report/route.ts` | 신규 | GET 기간별 본인 기록 조회 API + totalHoursSum 집계 |
| `src/app/dashboard/report/page.tsx` | 신규 | 업무내용 제공 페이지 (기간 선택 + 결과 테이블 + 합계 행) |
| `src/app/dashboard/page.tsx` | 수정 | 메뉴 카드 2개 → 3개 (업무내용 제공 추가, 3열 그리드) |
| `src/components/record/RecordForm.tsx` | 수정 | `hideHoliday={!targetUserId}` → `hideHoliday={false}` (직원도 공휴일 선택 가능) |
| `src/app/api/records/route.ts` | 수정 | HOLIDAY ADMIN 전용 체크 제거 |
| `src/app/api/records/[id]/route.ts` | 수정 | HOLIDAY ADMIN 전용 체크 제거 |

**기능 요약**
- `/dashboard/report`: 기간 선택 → 날짜/업무상태/근무시간/업무현장/업무내용 테이블 + 총 근무시간 합계
- 집계 규칙: WORK=실제 totalHours, SICK/ANNUAL/HOLIDAY=8시간 고정, UNPAID=0시간(제외)
- 직원도 공휴일 상태 기록 가능 (기존에는 ADMIN만 가능)

**타입체크:** 오류 없음 ✅

---

## 2026-05-25

### 이슈 #1 진단 결과
- 근무시간 10:00-18:00 표시는 디스플레이 버그 아님 — 직원들이 실제로 10:00-18:00 입력함
- 기존 데이터: 관리자 대리 입력(수정)으로 직접 정정 가능
- 재발 방지: 이슈 #5(기본값)로 해결

### 이슈 #2 수정 — 보고서 페이지 데이터 미리보기 추가
- `src/app/admin/report/page.tsx` 재작성
- DateRangePicker의 onSearch 연결 (기존 no-op → searchTrigger 증가)
- 조회 후 SummaryTable(직원별 집계) 미리보기 표시
- PDF 다운로드 버튼은 집계 확인 후 사용 가능

### 이슈 #3 수정 — PDF 생성 에러 수정
- `src/app/api/admin/report/route.ts`: `export const runtime = 'nodejs'` + `maxDuration = 60` 추가
- `src/lib/pdf/ReportDocument.tsx`: 폰트 로딩 방식 파일 경로 → data URI 방식으로 변경
  - `fs.readFileSync` + base64 변환 → Windows 경로 파싱 오류 및 Edge Runtime 의존성 제거

### 이슈 #4 완료 — 관리자 계정 추가 (jun / 1234)
- `prisma/seed-jun.ts` 생성 후 실행 완료
- DB에 jun(준 관리자, ADMIN 역할, isFirstLogin=false) 계정 생성됨

### 이슈 #5 완료 — 기본 근무 시간 07:00/15:00 설정
- `src/components/record/RecordForm.tsx`
- 신규 기록 입력 시 startTime 기본값 `''` → `'07:00'`
- 신규 기록 입력 시 endTime 기본값 `''` → `'15:00'`
- 기존 기록 수정 시 기존 값 그대로 유지

### 세션2 — 6대 이슈 일괄 수정 (2026-05-25)

| 번호 | 파일 | 내용 |
|------|------|------|
| 직원 공휴일 제거 | StatusSelector.tsx, RecordForm.tsx | hideHoliday prop — 직원 폼에서 HOLIDAY 숨김, 관리자 대리입력 시만 표시 |
| 보고서 크로스 테이블 | DailyGrid.tsx (신규), report/daily/route.ts (신규), report/page.tsx | 날짜×직원 근무시간 크로스 테이블 생성 |
| KST 제거 | time.ts, RecordForm.tsx, ReportDocument.tsx | 시간 저장/표시 KST 변환 제거 — 입력값 그대로 UTC |
| 게시판 메뉴 | dashboard/page.tsx | 헤더 탭 네비게이션 "업무 기록" / "도면 게시판" 분리 |
| 보고서 조회 | summary/route.ts | 날짜 필터 +09:00 → Z 수정 |
| 자동 시간 | records/route.ts, records/[id]/route.ts, override/route.ts | SICK/ANNUAL/HOLIDAY → 07:00~15:00 자동 8시간 처리 |

타입체크 0오류, next build 성공.

---

### 이슈 #7 완료 — PDF 생성 React error #31 근본 수정 (2026-05-25)

**원인 분석 (3회 이후 심층 조사)**
- Next.js RSC(React Server Components) 컴파일러가 JSX 팩토리로 `vendored["react-rsc"].ReactJsxRuntime` 사용
- RSC JSX runtime은 `Symbol.for("react.transitional.element")` 를 `$$typeof`로 사용 (React 18.3+)
- @react-pdf/renderer에 번들된 react-reconciler@0.23.0은 `Symbol.for("react.element")`만 인식
- 두 심볼 불일치로 모든 JSX 요소를 "invalid React child"로 처리 → Minified React error #31

**수정 내용**
- `scripts/patch-react-pdf.js` 신규 생성:
  - `ca` 상수(react.element) 뒤에 `caT` 상수(react.transitional.element) 추가
  - reconciler 내 `switch(x.$$typeof)` 4개에 `case caT:` fall-through 추가
  - node_modules + standalone/node_modules 양쪽 자동 패치
  - 기존 파일 .bak 백업 후 덮어쓰기
- `package.json` scripts 수정:
  - `"postinstall": "node scripts/patch-react-pdf.js"` — npm install 후 자동 패치
  - `"build": "next build && node scripts/patch-react-pdf.js"` — 빌드 후 standalone 재패치

**검증**
- standalone server (port 3000, patched): PDF 생성 성공 ✅ (23,120 bytes, %PDF-1.3 헤더)
- dev server (port 9955, patched + 재시작): PDF 생성 성공 ✅ (23,120 bytes)
- 임시 테스트 파일 전체 삭제 완료

---

### 이슈 #6 완료 — 도면 게시판 신규 기능
**DB 스키마**
- `prisma/schema.prisma`: Drawing 모델 추가 (siteName, floor, fileName, filePath, fileSize, createdBy, createdAt)
- `prisma/migrations/20260525035735_add_drawing_model/` 마이그레이션 적용 완료

**API 라우트**
- `src/app/api/admin/drawings/route.ts`: POST 파일 업로드 (관리자 전용, multipart/form-data)
- `src/app/api/admin/drawings/[id]/route.ts`: DELETE 삭제 (관리자 전용)
- `src/app/api/drawings/route.ts`: GET 목록 조회 (인증 사용자 모두)
- `src/app/api/drawings/[id]/file/route.ts`: GET PDF 스트리밍 (inline 표시)

**파일 저장**
- 위치: `{cwd}/uploads/drawings/{uuid}.pdf`
- `uploads/` 디렉토리 `.gitignore` 추가

**페이지**
- `src/app/drawings/layout.tsx`: 공용 레이아웃 (인증 필수)
- `src/app/drawings/DrawingsNav.tsx`: 역할별 네비게이션 헤더
- `src/app/drawings/page.tsx`: 목록 (현장명 검색, 행 클릭 → 뷰어)
- `src/app/drawings/[id]/page.tsx`: PDF 뷰어 (iframe inline)
- `src/app/admin/drawings/page.tsx`: 관리자 관리 페이지 (업로드/삭제)

**네비게이션**
- `src/app/admin/AdminNav.tsx`: "도면" 메뉴 추가 → /admin/drawings
- `src/app/dashboard/page.tsx`: "도면" 버튼 추가 → /drawings

**타입**
- `src/types/index.ts`: DrawingDTO 추가

---

### 이슈 #8 완료 — PDF 내용 변경: 보고서 페이지 형식 그대로 PDF 출력 (2026-05-25)

**요청 사항**
- PDF 내용을 관리자 보고서 페이지(직원별 집계 + 날짜별 상세 기록)와 동일하게 변경

**변경 내용**

`src/lib/pdf/ReportDocument.tsx` 전면 재작성:
- 기존: 직원별 개별 상세 테이블 (직원당 1페이지)
- 신규: 직원별 집계(SummaryTable) + 날짜별 상세 기록(DailyGrid 크로스 테이블)
- `PdfSummarySection`: SummaryTable.tsx와 동일한 8컬럼 + 합계 행(직원 2명 이상)
- `PdfDailyGridSection`: DailyGrid.tsx와 동일한 크로스 테이블, 동적 열 너비, 비고 로직
- `DailyRecord`, `DayData`, `DailyGridData` 타입 export — 순환 의존성 제거

`src/lib/pdf/generateReport.ts` 전면 재작성:
- `generateReportFromDB` 단일 함수로 통합
- DB 단일 조회(employees, workRecords, holidays)로 summary + dailyGrid 동시 계산
- summary/route.ts, report/daily/route.ts 로직과 완전 동일한 집계 규칙 적용

**검증**
- TypeScript 타입체크: 오류 없음 ✅
- PDF 생성 테스트 (port 9955): 성공 ✅ (23,433 bytes)

---

## 2026-05-18

### CLAUDE.md 생성 (V1 → V2)
- 변경 파일: `CLAUDE.md`
- 변경 내용: 프로젝트 지침 최초 생성, 기술 스택 확정(Next.js 14, PostgreSQL, Prisma, NextAuth.js, @react-pdf/renderer), 서브에이전트 목록 정의
- 변경 이유: 프로젝트 시작 — 글로벌 CLAUDE.md new_project_setup.md 규칙 준수

### .claude/agents/*.md 생성
- 변경 파일: `.claude/agents/researcher.md`, `.claude/agents/planner.md`, `.claude/agents/builder.md`, `.claude/agents/reviewer.md`, `.claude/agents/critic.md`, `.claude/agents/historian.md`
- 변경 내용: 6개 서브에이전트 역할 파일 최초 생성
- 변경 이유: new_project_setup.md 트리거 — CLAUDE.md 생성 시 동시 생성 의무

### .claude/advisor_workflow.md 생성
- 변경 파일: `.claude/advisor_workflow.md`
- 변경 내용: 프로젝트 특화 에스컬레이션 조건(JF-ESC-001~005) 정의
- 변경 이유: new_project_setup.md 트리거

### RESEARCH.md 생성 (V1 → V2)
- 변경 파일: `RESEARCH.md`
- 변경 내용: 요구사항 분석 보고서 작성. V1 초안 → Critic 검토(20개 문제, 55%) → V2 전면 수정 → Critic 재검토(98% APPROVED)
- 주요 확정 내용:
  - 데이터 모델 3테이블 확정 (User, WorkRecord, Holiday)
  - 야간 근무: DateTime 타입, totalHours 서버 자동 계산
  - HOLIDAY: WorkRecord.status 제거, Holiday 별도 테이블
  - API 보안: 엔드포인트별 Role 검증 명세
  - 비밀번호 정책: bcrypt, isFirstLogin, 최소 8자
  - UNIQUE(userId, date) 제약
  - PDF 레이아웃: A4, 표지+집계요약+직원별상세
  - 비즈니스 규칙 26개, 엣지 케이스 15개, 에러 메시지 16개
- 변경 이유: /order1 — 요구사항 심층 분석 및 RESEARCH.md 작성 작업

### CRITIC_REVIEW_V1.md, CRITIC_REVIEW_V2.md 생성
- 변경 파일: `CRITIC_REVIEW_V1.md`, `CRITIC_REVIEW_V2.md`
- 변경 내용: V1 검토(20개 문제 발굴, 완성도 55%), V2 최종 검증(완성도 98% APPROVED)
- 변경 이유: 요구사항 분석 정확성 보증 — 3회 반복(초안→검토→수정→재검토) 사이클 완료

### code_update.md 신규 생성
- 변경 파일: `code_update.md`
- 변경 내용: 변경 이력 로그 최초 생성
- 변경 이유: 글로벌 CLAUDE.md 규칙 준수 — 단계별 작업 추적 의무

### talk_history.md 신규 생성
- 변경 파일: `talk_history.md`
- 변경 내용: 세션 요약 최초 생성
- 변경 이유: 글로벌 CLAUDE.md 규칙 준수 — 세션 종료 시 요약 의무

---

## 2026-05-18 (2차)

### PLAN.md 생성 (V1 → V3)
- 변경 파일: PLAN.md
- 변경 내용:
  - V1 초안: 8단계 구현 계획, cursor 기반 페이징, 코드 스니펫 포함 (66KB)
  - Critic V1 검토: CRITICAL 3, MAJOR 11, MINOR 4 — 총 18건 발견
  - V2 수정: 타임존 버그(date-fns-tz 전환), @db.Date 선언, cursor 범용 유틸, 소유자 검증, PDF 응답 패턴, PM2 env_file, 폰트 복사 등 전부 반영 (82KB)
  - Critic V2 검토: 98점 APPROVED, 신규 4건 발견
  - V3 최종: middleware matcher 수정, holidays API 스니펫, staff PATCH 스니펫, calcTotalHours 엣지케이스 처리
- 변경 이유: /order2 — RESEARCH.md 기반 상세 구현 계획 작성

### PLAN_CRITIC_V1.md, PLAN_CRITIC_V2.md 생성
- 변경 파일: PLAN_CRITIC_V1.md, PLAN_CRITIC_V2.md
- 변경 내용: V1 검토(18건), V2 검토(98점 APPROVED)
- 변경 이유: 97% 완성도 보장 비판적 검토 사이클

---

## 2026-05-18 (3차)

### 단계 6: UI 컴포넌트 + 앱 페이지 전체 구현 ✅

**생성 파일 목록 (27개):**

#### 공통 UI 컴포넌트
- `src/components/ui/Button.tsx` — variant(primary/secondary/danger/ghost), size(sm/md/lg), isLoading 지원
- `src/components/ui/Input.tsx` — label, error 메시지 내장, forwardRef
- `src/components/ui/Modal.tsx` — 확인/취소 모달, variant(default/danger)
- `src/components/ui/Toast.tsx` — Context API 기반 전역 토스트, 3초 자동 소멸
- `src/components/ui/LoadingSpinner.tsx` — animate-spin, size(sm/md/lg)

#### 달력 컴포넌트
- `src/components/calendar/Calendar.tsx` — 월 네비게이션, 7열 그리드, 오늘 자동 포커스
- `src/components/calendar/CalendarDay.tsx` — 상태별 배경색, 공휴일 보라색, 오늘 ring 강조
- `src/components/calendar/CalendarLegend.tsx` — 6가지 상태 색상 범례

#### 기록 입력 컴포넌트
- `src/components/record/StatusSelector.tsx` — 4상태 라디오 그룹, 선택 색상 강조
- `src/components/record/RecordForm.tsx` — WORK/비WORK 동적 필드, 야간근무 감지, POST/PUT/DELETE

#### 관리자 컴포넌트
- `src/components/admin/StaffTable.tsx` — cursor Load More, 비활성화/재활성화 모달
- `src/components/admin/DateRangePicker.tsx` — 시작/종료일 인풋 + 조회 버튼
- `src/components/admin/ReportTable.tsx` — 전직원 기록 cursor Load More, searchTrigger 기반 재조회
- `src/components/admin/HolidayManager.tsx` — 공휴일 등록/삭제 관리

#### 공통 컴포넌트
- `src/components/SessionProvider.tsx` — NextAuth SessionProvider 래퍼

#### 앱 레이아웃 + 페이지
- `src/app/globals.css` — Tailwind 임포트, Noto Sans KR, 커스텀 스크롤바
- `src/app/layout.tsx` — 루트 레이아웃, SessionProvider, ToastProvider
- `src/app/page.tsx` — 랜딩 페이지, useSession 역할별 리다이렉트
- `src/app/login/page.tsx` — credentials signIn, INACTIVE_ACCOUNT 에러 처리
- `src/app/change-password/page.tsx` — 최초 로그인 강제 변경, session update
- `src/app/dashboard/page.tsx` — 월간 달력 뷰, 업무 기록 fetch
- `src/app/dashboard/record/[date]/page.tsx` — 날짜별 기록 입력/수정
- `src/app/admin/layout.tsx` — Server Component, ADMIN 세션 검증
- `src/app/admin/AdminNav.tsx` — 관리자 네비게이션 헤더 (추가 생성)
- `src/app/admin/page.tsx` — 관리자 대시보드, 현재 주 기본 표시
- `src/app/admin/staff/page.tsx` — 직원 관리, 신규 등록 인라인 폼
- `src/app/admin/report/page.tsx` — PDF 다운로드, Blob 처리
- `src/app/admin/records/[userId]/[date]/page.tsx` — 관리자 대리 입력

#### API 추가
- `src/app/api/holidays/route.ts` — 공개 공휴일 조회 (인증 불필요, 달력용)

**주요 결정 사항:**
- ReportTable searchTrigger 처리: render 중 setState 패턴 → useEffect + useRef 패턴으로 수정
- AdminNav를 별도 Client Component로 분리 (layout.tsx가 Server Component이므로)
- 달력 미기록 판단: isCurrentMonth && !isFuture && !record → bg-red-400
- 관리자 대리 입력: RecordForm apiBasePath + targetUserId prop으로 동일 컴포넌트 재사용

**변경 이유:** /order3 builder 에이전트 — 단계 6 UI 컴포넌트 구현

---

## 2026-05-18 (3차) — /order3 구현 완료

### 전체 구현 완료 (8단계)

#### 단계1: 프로젝트 초기화 ✅
- 생성: package.json, tsconfig.json, next.config.js, .env.example, .gitignore, tailwind.config.ts, postcss.config.js
- 이유: Next.js 14 + TypeScript + Tailwind 기반 세팅

#### 단계2: Prisma 스키마 ✅
- 생성: prisma/schema.prisma, prisma/seed.ts
- 핵심: @db.Date, @@unique([userId,date]), Holiday 별도 테이블, 인덱스 4개

#### 단계3: NextAuth 인증 ✅
- 생성: src/lib/prisma.ts, src/lib/auth.ts, src/app/api/auth/[...nextauth]/route.ts, src/middleware.ts, src/next-auth.d.ts
- 핵심: JWT 8시간, isActive/isFirstLogin 체크, matcher에서 '/' 제거

#### 단계4: 공통 타입/유틸 ✅
- 생성: src/types/index.ts, src/lib/utils/time.ts, src/lib/utils/date.ts, src/lib/utils/pagination.ts
- 핵심: date-fns-tz 기반 KST 처리, cursor 페이징 유틸, RoleLabel/StatusLabel

#### 단계5: API Routes ✅
- 직원 API: src/app/api/records/route.ts, [id]/route.ts, password/route.ts
- 관리자 API: admin/records, admin/records/override, admin/staff, admin/staff/[id], admin/holidays, admin/holidays/[id], admin/report, api/holidays
- 핵심: cursor 기반 페이징, P2002 에러 처리, 소유자 검증, KST 타임존

#### 단계6: UI 컴포넌트 + 페이지 ✅
- 생성: 28개 파일 (컴포넌트 16개 + 페이지 12개)
- 핵심: 달력 상태 색상(6가지), RecordForm 야간근무 감지, Toast 전역 시스템, 관리자 네비게이션

#### 단계7: PDF 생성 ✅
- 생성: src/lib/pdf/generateReport.ts, src/lib/pdf/ReportDocument.tsx
- 핵심: Noto Sans KR 내장, 공휴일 행 포함, 직원별 집계, 가나다순, 페이지 헤더/푸터

#### 단계8: 배포 설정 ✅
- 생성: ecosystem.config.js, nginx.conf, scripts/backup.sh, logs/.gitkeep
- 핵심: PM2 env_file, Nginx 정적 캐시 1년, pg_dump 30일 보관, Let's Encrypt HTTPS

### Reviewer 수정 (3건)
- admin/report/route.ts: generateReportFromDB로 교체 (Date→string DTO 변환 버그)
- RecordForm.tsx: 204 No Content 파싱 오류 수정
- generateReport.ts: 미사용 import 제거

### 최종 완성도: 97% APPROVED

---

## 2026-05-18 (세션 2 — DB 연결 및 타입 오류 수정)

### MariaDB 설정 완료
- `C:\MariaDB\bin\mysql.exe` 발견 (bin 디렉토리)
- root / 740923aa로 접속 성공
- `junfire` DB 생성 (utf8mb4_unicode_ci)
- admin 계정 생성 + junfire.* 전체 권한 부여
- Prisma migrate dev --name init 성공
- seed 실행: tsconfig.seed.json (CommonJS) 방식으로 해결
- admin/admin 계정 DB 생성 확인

### 타입 오류 전면 수정
**email → username 전환 (email 필드가 User 모델에 없음)**
- `src/app/api/admin/staff/route.ts`: select의 email → username
- `src/app/api/admin/staff/[id]/route.ts`: USER_SELECT email → username, PUT body email → username 제거, 역할 타입 Role 캐스팅
- `src/app/api/admin/records/route.ts`: include user select email → username
- `src/app/api/admin/staff/page.tsx`: formEmail → formUsername, 이메일 폼 → 아이디 폼
- `src/components/admin/StaffTable.tsx`: user.email → user.username, 이메일 헤더 → 아이디
- `src/lib/pdf/generateReport.ts`: UserReportEntry.user.email → username, generateReportFromDB user select 수정
- `src/types/index.ts`: WorkRecordDTO.user에 username 추가

**Next.js 15+ params Promise 수정 (3개 파일)**
- `src/app/api/admin/holidays/[id]/route.ts`
- `src/app/api/admin/staff/[id]/route.ts`
- `src/app/api/records/[id]/route.ts`
- 모두 `{ params: Promise<{ id: string }> }` + `const { id } = await params` 패턴으로 수정

**cursor 타입 오류 수정**
- `src/app/api/admin/records/route.ts`: `...cursorQuery` → `take: cursorQuery.take, cursor: { id: cursor }`
- `src/app/api/records/route.ts`: 동일 패턴 수정

**Buffer → Uint8Array 수정**
- `src/app/api/admin/report/route.ts`: `pdfBuffer` → `new Uint8Array(pdfBuffer)`

**React PDF 타입 수정**
- `src/lib/pdf/generateReport.ts`: `React.createElement(...)` → `as any` 단언

### 폰트 설정
- `public/fonts/NotoSansKR-Regular.ttf`: Windows 시스템 Malgun Gothic TTF 복사
- `@fontsource/noto-sans-kr` devDependency 설치

### middleware → proxy 변경
- `src/middleware.ts` → `src/proxy.ts` 이름 변경 (Next.js 16 deprecation 대응)

### 개발 서버 실행 확인
- `http://localhost:9955` 정상 응답
- 로그인 페이지, 세션 API 200 확인
- TypeScript 타입 오류 0개

---

## 2026-05-25 (2차)

### 관리자 보고서 페이지 — 날짜별 상세 테이블 추가

#### 신규 API 라우트
- `src/app/api/admin/report/daily/route.ts` — GET 엔드포인트
  - 쿼리: startDate(YYYY-MM-DD), endDate(YYYY-MM-DD), includeInactive(boolean)
  - ADMIN 권한 검증
  - 반환 구조: employees(가나다순) + days(날짜 순서, 크로스 테이블 데이터)
  - 근무시간 계산: WORK=실제값(소수점1자리), SICK/ANNUAL/HOLIDAY=8, UNPAID=0
  - 공휴일 Map 매칭 및 holiday.name 포함

#### 신규 컴포넌트
- `src/components/admin/DailyGrid.tsx` — 날짜×직원 크로스 테이블
  - Props: startDate, endDate, includeInactive, searchTrigger
  - searchTrigger 트리거 시 API 호출
  - 테이블 구조: 날짜(슬래시 포맷) | 직원들(정수/소수점1자리) | 비고
  - 비고 생성 로직: 공휴일명 > 토/일 요일 > SICK/ANNUAL/UNPAID 직원명
  - 행 스타일: 토요일(bg-blue-50) / 일요일(bg-red-50) / 공휴일(bg-yellow-50) / 홀수짝수교대
  - 합계 행: 직원별 총 근무시간 (bg-gray-100 강조)
  - 로딩/데이터없음 상태 처리

#### 기존 페이지 수정
- `src/app/admin/report/page.tsx`
  - DailyGrid import 추가
  - 직원별 집계 섹션 제목 변경 ("미리보기" 제거)
  - 날짜별 상세 기록 섹션 신규 추가 (Fragment 구조)
  - searchTrigger > 0 시 두 섹션 모두 표시
  - PDF 생성 로딩 메시지 위치 조정

#### 타입 검증
- TypeScript 타입 에러 0개 (신규 작성 파일 기준)
- LoadingSpinner import 문법 수정 (named → default export)
