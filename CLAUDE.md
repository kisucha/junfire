# JunFire Protection — 업무시간 관리 시스템 프로젝트

| 항목 | 내용 |
|------|------|
| Document Name | JunFire Protection 프로젝트 CLAUDE.md |
| Version | V2 |
| Date | 2026-05-18 |
| Author | kisucha |
| Document Type | 프로젝트 지침 |
| Model Used | claude-sonnet-4-6 |

> 글로벌 CLAUDE.md(~/.claude/CLAUDE.md)의 공통 규칙은 이 파일에서 중복 작성하지 않음.
> 이 파일은 프로젝트 특화 정보만 포함.

---

## 프로젝트 개요

**회사명:** JunFire Protection  
**목적:** 직원별 업무 시간·장소·내용 기록 및 관리자 열람/PDF 다운로드 웹 애플리케이션  
**직원 규모:** 최대 5명 소규모  
**UI 언어:** 한국어  
**배포 환경:** 자체 서버 직접 운영  
**대상 사용자:**
- 일반 직원 (Employee): 자신의 업무 기록 입력/조회
- 관리자 (Admin / 사장님): 전 직원 업무 기록 조회 + PDF 출력

---

## 핵심 기능 요구사항

### 공통
- 회사 대문(랜딩 페이지): 회사 홈페이지 스타일, 로그인 진입점 제공
- 로그인/인증: 직원별 개별 계정, 관리자 계정 별도 권한

### 직원 기능
| 기능 | 설명 |
|------|------|
| 달력 뷰 | 월 단위 달력, 날짜별 상태 색상 표시 |
| 당일 자동 포커스 | 로그인 시 또는 달력 진입 시 오늘 날짜 자동 선택 |
| 날짜 클릭 → 기록 입력 | 선택한 날짜의 업무 기록 폼 열기 |
| 업무 시간 (필수) | 시작 시각 + 종료 시각 또는 총 근무시간 입력 |
| 업무 장소 (필수) | 사무실 / 현장 / 재택 등 선택 또는 직접 입력 |
| 업무 내용 (선택) | 자유 텍스트 입력 |
| 날짜 상태 선택 | 정상근무 / 병가 / 유급휴가(Annual Leave) / 무급휴가 중 택1 |
| 기록 수정/삭제 | 본인 기록에 한해 가능 |

### 관리자 기능
| 기능 | 설명 |
|------|------|
| 전 직원 달력 조회 | 날짜 클릭 시 해당 일자 전 직원 기록 표시 |
| 기간 조회 | 시작일 ~ 종료일 범위 선택 |
| 직원별 집계 | 기간 내 직원별 총 근무시간, 휴가/병가 일수 요약 |
| PDF 다운로드 | 선택 기간 전 직원의 날짜별 업무 내용 포함 PDF 생성 |
| 직원 계정 관리 | 직원 등록/수정/비활성화 |

---

## 날짜 상태(Status) 정의

| 코드 | 표시명 | 설명 |
|------|--------|------|
| `WORK` | 정상근무 | 업무 시간 + 장소 필수 입력 |
| `SICK` | 병가 | Sick Leave — 시간 입력 불필요 |
| `ANNUAL` | 유급휴가 | Annual Leave — 시간 입력 불필요 |
| `UNPAID` | 무급휴가 | Unpaid Leave — 시간 입력 불필요 |
| `HOLIDAY` | 공휴일 | 관리자가 지정 가능 |

---

## 페이지 구조

```
/ (랜딩 페이지 — 대문)
├── /login              로그인
├── /dashboard          직원 대시보드 (달력 + 오늘 기록)
│   └── /record/:date   특정 날짜 기록 입력/수정
└── /admin              관리자 대시보드
    ├── /admin/staff    직원 관리
    └── /admin/report   기간 조회 + PDF 다운로드
```

---

## 권한(Role) 구조

| Role | 접근 가능 경로 | 특이사항 |
|------|--------------|---------|
| `EMPLOYEE` | `/dashboard`, `/record/:date` | 본인 기록만 읽기/쓰기 |
| `ADMIN` | 전체 | 모든 직원 기록 읽기, PDF 출력, 직원 관리 |

---

## 기술 스택 (확정)

> 자체 서버 운영, 소규모(5명), 한국어 UI 기준으로 확정.

| 영역 | 선택 | 선택 이유 |
|------|------|----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS | 풀스택 단일 프레임워크, SSR/SSG 지원 |
| Backend | Next.js API Routes | 별도 서버 불필요 — 소규모에 충분 |
| DB | PostgreSQL (자체 서버 직접 설치) | 안정적, 자체 서버 운영에 적합 |
| ORM | Prisma | 타입 안전, 마이그레이션 편의 |
| 인증 | NextAuth.js (Credentials Provider) | 이메일+비밀번호 로그인, JWT 세션 |
| PDF 생성 | @react-pdf/renderer | 한국어 폰트 내장 가능, Node.js 서버사이드 렌더링 |
| 배포 | 자체 서버 + PM2 + Nginx 리버스 프록시 | 직접 운영 환경 |
| 한국어 폰트 | Noto Sans KR (PDF용 내장) | PDF 한글 깨짐 방지 |

**주의:** PDF 생성 시 `@react-pdf/renderer`에 Noto Sans KR TTF 파일 직접 임베드 필요 → 한글 깨짐 방지.

---

## 디렉토리 구조 (예정)

```
E:\Junfire\
├── CLAUDE.md               이 파일
├── GUIDE.md                전체 프로젝트 가이드 (생성 예정)
├── RESEARCH.md             요구사항 분석 문서
├── PLAN.md                 구현 계획
├── code_update.md          변경 이력 로그
├── talk_history.md         세션 요약
├── frontend/               프론트엔드 소스
├── backend/                백엔드 소스 (스택 확정 후)
└── docs/                   설계 문서 / ERD / 와이어프레임
```

---

## 데이터 모델 개요 (초안)

### User
- id, email, name, role(EMPLOYEE/ADMIN), isActive, createdAt

### WorkRecord
- id, userId, date, status(WORK/SICK/ANNUAL/UNPAID/HOLIDAY)
- startTime, endTime, totalHours (status=WORK일 때만 유효)
- location (status=WORK일 때 필수)
- description (선택)
- createdAt, updatedAt

---

## 서브에이전트 구성 (작업 시작 시 정의)

> 글로벌 CLAUDE.md 3절 규칙 적용. 모델 배정:
> - Executor: Sonnet (분석·설계·구현) 또는 Haiku (반복·템플릿 작업)
> - Advisor: Opus (에스컬레이션 전용)

| 에이전트 | 역할 | 모델 |
|---------|------|------|
| researcher | 요구사항 분석 및 RESEARCH.md 작성 | Sonnet |
| planner | PLAN.md 작성 (코드 스니펫 포함) | Sonnet |
| builder | 실제 코드 구현 | Sonnet |
| reviewer | 코드 리뷰 및 검증 | Sonnet |
| historian | code_update.md / talk_history.md 기록 | Haiku |
| advisor | 에스컬레이션 판단 (직접 실행 금지) | Opus |

---

## 작업 우선순위 (기획 단계)

1. ~~요구사항 확정~~ ✅
2. ~~기술 스택 확정~~ ✅
3. ERD + 와이어프레임 설계
4. PLAN.md 작성 및 사용자 리뷰
5. `구현해줘` 트리거 후 코딩 시작

---

## ⛔ 구현 전 필수 탐색 체크리스트 (반복실수 #1 방지)

> 근거: `proxy.ts` 존재 모르고 `middleware.ts` 중복 생성 → 빌드 오류 발생 (2026-06-16)
> 상세 내용: `반복실수.md` 참조

구현 시작 전 아래 순서를 반드시 실행한다.

```
[ ] 1. src/**/*.ts + src/**/*.tsx 전체 Glob으로 파일 목록 파악
[ ] 2. Next.js 특수 파일 확인: middleware.ts / proxy.ts 양쪽 다
[ ] 3. 관련 API 라우트 전수 확인: src/app/api/**/*.ts
[ ] 4. 관련 페이지 전수 확인: src/app/**/page.tsx
[ ] 5. 계획서에 명시: "기존 X 수정 / Y 신규 생성" — 사용자 확인 후 코딩
```

**규칙:** 신규 파일 생성 전 동일 목적 파일 존재 여부 반드시 확인. 있으면 수정, 없으면 신규.

---

## 주의사항 / 반복실수 방지

- Windows 환경 → 인코딩 점검 필수 (글로벌 규칙 참조)
- **PDF 한글 폰트 깨짐** → `@react-pdf/renderer` 에 Noto Sans KR TTF 파일 직접 임베드 필수
- **날짜/시간 타임존** → 서버·DB 모두 `Asia/Seoul` (UTC+9) 명시
- Prisma 마이그레이션 → 스키마 변경 시 반드시 `prisma migrate dev` 후 커밋
- NextAuth 세션 → `NEXTAUTH_SECRET` 환경변수 서버에 반드시 설정
- PM2 재시작 → `.env` 변경 시 `pm2 restart` 필요 (자동 반영 안 됨)
- **Next.js 특수 파일** → 버전에 따라 `middleware.ts` → `proxy.ts` 이름 다름. 양쪽 다 확인 필수

## 환경변수 목록 (배포 시 필수)

| 변수명 | 설명 |
|--------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `NEXTAUTH_SECRET` | NextAuth 서명 시크릿 (랜덤 32자+) |
| `NEXTAUTH_URL` | 서버 도메인 (예: http://서버IP:3000) |
