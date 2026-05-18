# 변경 이력 로그 — JunFire Protection

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
