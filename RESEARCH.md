# JunFire Protection — 업무시간 관리 시스템 요구사항 분석 보고서

| 항목 | 내용 |
|------|------|
| Document Name | JunFire Protection 요구사항 분석 보고서 |
| Version | V2 |
| Date | 2026-05-18 |
| Author | researcher (claude-sonnet-4-6) |
| Document Type | 요구사항 분석 보고서 |
| Model Used | claude-sonnet-4-6 |

> V2 변경사항: Critic Review V1 피드백 전체 반영. CRITICAL 5개, MAJOR 10개, MINOR 5개 해결.
> 야간근무 데이터 모델 확정, Holiday 별도 테이블 추가, API 보안 명세 구체화, 비밀번호 정책 추가, 달력 색상 hex 코드 확정.

---

## 1. 프로젝트 개요 요약

JunFire Protection은 소규모(최대 5명) 소방 관련 기업으로, 직원별 업무 시간·장소·내용을 디지털로 기록하고 관리자가 이를 열람·PDF로 출력할 수 있는 웹 애플리케이션을 필요로 한다.

**배경 및 필요성:**
- 현재 수기 또는 비체계적 방식으로 업무시간을 관리하고 있을 가능성이 높음
- 노무 관리·급여 산정·세금 신고 등을 위해 정확한 근무 기록 보존 필요
- 관리자(사장님)가 언제든지 특정 기간의 전 직원 근무 기록을 한눈에 조회하고 PDF로 출력하여 증빙 자료로 활용 가능해야 함

**핵심 목표:**
1. 직원이 날짜별 업무 내용을 간편하게 입력
2. 관리자가 기간·직원별 근무 현황을 한눈에 파악
3. PDF 보고서 생성으로 오프라인 보관·제출 가능

---

## 2. 시스템 사용자 분석

### 2.1 직원(Employee) 사용자 행동 패턴

**주요 사용 시나리오:**
1. 매일 퇴근 전후 당일 업무 기록 입력
2. 누락된 이전 날짜 기록 소급 입력 (출장·현장 작업 등으로 당일 입력 불가한 경우)
3. 잘못 입력한 기록 수정
4. 본인의 월간 근무 달력 조회 (요약 확인용)

**기술 수준 고려:**
- 소방 관련 업종 특성상 디지털 도구에 익숙하지 않을 수 있음
- UI는 직관적이어야 하며, 입력 단계를 최소화해야 함
- 모바일 환경에서도 접근 가능한 반응형 UI 필요 (현장에서 스마트폰으로 입력 가능성)

**사용 빈도:**
- 평일 기준 하루 1~2회 (출근 기록, 퇴근 기록)
- 동시 접속자: 최대 5명 (소규모)

### 2.2 관리자(Admin) 사용자 행동 패턴

**주요 사용 시나리오:**
1. 월말/분기별 전 직원 근무 현황 조회
2. 급여 산정을 위한 기간별 총 근무시간 집계
3. 노무 신고·세무 처리를 위한 PDF 출력
4. 신규 직원 계정 등록 / 퇴직 직원 계정 비활성화
5. 공휴일 지정 (Holiday 테이블에 날짜·이름 등록)

**관리자 특성:**
- 상세 데이터 조회보다 집계/요약 정보를 먼저 보고 싶을 것
- 빠른 PDF 다운로드가 핵심 가치
- 직원 계정 관리는 빈도가 낮지만 오류 없이 처리되어야 함

---

## 3. 기능 요구사항 상세

### 3.1 인증/보안

**명시된 요구사항:**
- 직원별 개별 계정 (이메일 + 비밀번호)
- 관리자 계정 별도 권한 (ADMIN role)
- NextAuth.js Credentials Provider 사용

**세부 기능 정의:**

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 이메일/비밀번호 로그인 | NextAuth Credentials Provider | 필수 |
| JWT 세션 관리 | NEXTAUTH_SECRET 환경변수 기반 | 필수 |
| Role 기반 접근 제어 | EMPLOYEE / ADMIN 분리 | 필수 |
| 로그인 실패 처리 | 잘못된 자격증명 에러 메시지 | 필수 |
| 비밀번호 해시 저장 | bcrypt (cost factor 12 권장) | 필수 |
| 세션 만료 처리 | 만료 시 로그인 페이지 리다이렉트 | 필수 |
| 비밀번호 재설정 | 관리자가 임시 비밀번호 부여 후 화면 1회 표시 | 필수 |
| 로그아웃 | 세션 무효화 | 필수 |
| 최초 로그인 강제 변경 | isFirstLogin=true 시 비밀번호 변경 강제 | 필수 |

**[C-004 해결] 비밀번호 정책 (확정):**
- 최소 8자 이상
- 영문 대소문자 + 숫자 + 특수문자 중 최소 2가지 조합
- 초기 비밀번호: 관리자가 직접 설정 → 등록 완료 후 화면에 1회만 표시 ("반드시 메모하세요" 안내)
- 최초 로그인 시 비밀번호 변경 강제 (User 테이블의 isFirstLogin 필드 활용)
- 비밀번호 재설정: 관리자가 임시 비밀번호 부여 → isFirstLogin=true 재설정 → 직원 다음 로그인 시 강제 변경
- 로그인 실패 횟수 제한: 이번 버전에서는 미구현 (소규모 내부 시스템, 단순성 우선)
- 이메일 발송 기능: 이번 버전에서는 미구현 (관리자가 화면에서 직접 확인 후 직원에게 구두/문자 전달)

**[C-003 해결] API 엔드포인트별 권한 검증 명세:**

| API 엔드포인트 | 허용 Role | 서버사이드 검증 내용 |
|--------------|-----------|-------------------|
| GET /api/records/my | EMPLOYEE, ADMIN | 세션 userId 기준으로만 조회 (URL 파라미터 userId 무시) |
| POST /api/records | EMPLOYEE, ADMIN | 세션 userId로 생성 (요청 body의 userId 무시) |
| PUT /api/records/:id | EMPLOYEE, ADMIN | 기록 소유자(userId) = 세션 userId 검증 |
| DELETE /api/records/:id | EMPLOYEE, ADMIN | 기록 소유자(userId) = 세션 userId 검증 |
| GET /api/admin/records | ADMIN 전용 | ADMIN role 검증 필수. EMPLOYEE 요청 시 403 |
| GET /api/admin/users | ADMIN 전용 | ADMIN role 검증 필수 |
| POST /api/admin/users | ADMIN 전용 | ADMIN role 검증 필수 |
| PUT /api/admin/users/:id | ADMIN 전용 | ADMIN role 검증 필수 |
| POST /api/admin/report/pdf | ADMIN 전용 | ADMIN role 검증 필수 |
| GET /api/admin/holidays | ADMIN 전용 | ADMIN role 검증 필수 |
| POST /api/admin/holidays | ADMIN 전용 | ADMIN role 검증 필수 |
| DELETE /api/admin/holidays/:id | ADMIN 전용 | ADMIN role 검증 필수 |

**URL 파라미터 조작 방지 규칙:**
- /record/:date 에서 date 파라미터: YYYY-MM-DD 형식 유효성 검증 필수 (서버사이드)
- 유효하지 않은 date → 400 Bad Request
- 세션 없이 API 접근 → 401 Unauthorized
- Role 불일치 → 403 Forbidden

**보안 정책:**
- 모든 API Route에서 getServerSession() 호출 → 세션 미존재 시 즉시 401 반환
- EMPLOYEE는 자신의 userId와 일치하는 기록만 읽기/쓰기 가능
- ADMIN은 모든 직원 기록 읽기 가능, 수정은 Admin Override 정책 적용 (섹션 7 BR-009 참조)

### 3.2 랜딩 페이지

**명시된 요구사항:**
- 회사 홈페이지 스타일의 대문 페이지
- 로그인 진입점 제공

**세부 기능 정의:**

| 요소 | 설명 | 우선순위 |
|------|------|----------|
| 회사명/로고 표시 | JunFire Protection 브랜딩 | 필수 |
| 로그인 버튼 | /login 으로 이동 | 필수 |
| 회사 소개 문구 | 간략한 서비스 설명 | 권장 |
| 반응형 레이아웃 | 모바일/데스크탑 대응 | 필수 |

**동작 규칙:**
- 비로그인 사용자: 페이지 정상 표시
- 로그인된 EMPLOYEE: /dashboard 자동 리다이렉트
- 로그인된 ADMIN: /admin 자동 리다이렉트

### 3.3 직원 대시보드 (달력)

**명시된 요구사항:**
- 월 단위 달력 뷰
- 날짜별 상태 색상 표시
- 로그인 시 오늘 날짜 자동 포커스
- 달력 진입 시 오늘 날짜 자동 선택

**세부 기능 정의:**

| 요소 | 설명 | 우선순위 |
|------|------|----------|
| 월 달력 렌더링 | 해당 월의 전체 날짜 표시 | 필수 |
| 날짜별 상태 색상 | 각 Status별 구분 색상 (hex 코드 확정, 섹션 13 참조) | 필수 |
| 오늘 날짜 자동 포커스 | 현재 날짜 강조 표시 (테두리 강조) | 필수 |
| 이전/다음 달 이동 | 월 단위 네비게이션 | 필수 |
| 날짜 클릭 → 기록 폼 이동 | /record/:date 로 이동 | 필수 |
| 미기록 날짜 표시 | 과거 날짜 중 기록 없는 날짜 빨간색 표시 | 필수 |
| 요약 정보 표시 | 월간 총 근무시간, 휴가 일수 등 | 권장 |
| 공휴일 표시 | Holiday 테이블 조회 → 해당 날짜 보라색 표시 | 필수 |

**[M-007 해결] 달력 색상 코드 (확정):**

| 상태 | Tailwind 클래스 | Hex 코드 | 설명 |
|------|----------------|---------|------|
| WORK (기록 있음) | bg-green-500 | #22C55E | 정상 근무 완료 |
| WORK (기록 없음, 과거) | bg-red-500 | #EF4444 | 미입력 (오늘 이전 날짜) |
| SICK | bg-yellow-500 | #EAB308 | 병가 |
| ANNUAL | bg-blue-500 | #3B82F6 | 유급휴가 |
| UNPAID | bg-gray-500 | #6B7280 | 무급휴가 |
| HOLIDAY | bg-purple-500 | #8B5CF6 | 공휴일 (Holiday 테이블 기준) |
| 미래 날짜 | bg-white (기본) | #FFFFFF | 미입력 가능 |
| 오늘 날짜 | ring-2 ring-blue-700 | 테두리 강조 | 다른 상태 색상과 중첩 가능 |

**중첩 상태 우선순위 규칙:**
- 공휴일(HOLIDAY) + 근무기록(WORK) 동시 존재 시: WorkRecord 상태가 우선 표시 (공휴일에도 출동 기록 존재)
- 오늘 날짜 강조 테두리: 어떤 상태든 ring-2 ring-blue-700 추가 적용
- 달력 셀 배경색 = WorkRecord status 색상 (없으면 HOLIDAY 색상, 없으면 미래/과거 기본색)

**[UC-010 해결] 모바일 반응형 지원 기준:**
- 최소 지원 해상도: 375px (iPhone SE 기준)
- 달력 7열 레이아웃: 모바일에서 날짜 셀 최소 높이 44px 보장 (터치 영역)
- 달력 셀 폰트: 모바일 12px, 데스크탑 14px
- Tailwind 반응형 브레이크포인트: sm(640px), md(768px) 기준 레이아웃 전환

**접근 제어:**
- 로그인하지 않은 사용자 접근 시 /login 리다이렉트
- ADMIN 계정이 /dashboard 접근 시: /admin 으로 리다이렉트 (섹션 3.5 UC-003 해결 내용 참조)

### 3.4 업무 기록 입력 폼

**명시된 요구사항:**
- 날짜 클릭 → 해당 날짜 기록 폼 열기 (/record/:date)
- 업무 시간 (필수 for WORK): 시작 시각 + 종료 시각
- 업무 장소 (필수 for WORK): 사무실 / 현장 / 재택 등 선택 또는 직접 입력
- 업무 내용 (선택): 자유 텍스트
- 날짜 상태 선택: 정상근무 / 병가 / 유급휴가 / 무급휴가 중 택1 (HOLIDAY는 관리자만 지정)
- 기록 수정/삭제: 본인 기록에 한해 가능

**[C-001 해결] 야간 근무 지원 — 시간 저장 방식 확정:**
- startTime, endTime: HH:mm String이 아닌 DateTime (ISO 8601) 타입으로 저장
- 야간 근무 시나리오: startTime=2026-05-18T22:00+09:00, endTime=2026-05-19T06:00+09:00 → 다음날 날짜 자동 포함
- totalHours = endTime - startTime (서버사이드 자동 계산, 직접 입력 불가)
- date 필드 = 근무 시작일 기준 (야간 근무는 시작일로 기록)
- UI 입력: 시작 시각(HH:mm) + 종료 시각(HH:mm) 입력. 종료 시각이 시작 시각보다 작으면 다음날로 자동 처리
- 예: 시작 22:00, 종료 06:00 → totalHours = 8.0 (서버에서 날짜 경계 자동 계산)
- UNIQUE(userId, date) 제약: date는 시작일 기준이므로 야간 근무도 1건으로 관리

**[UC-001 해결] 미래 날짜 입력 정책 (확정):**
- SICK, ANNUAL, UNPAID: 미래 날짜 입력 허용 (휴가 사전 등록 필요)
- WORK: 미래 날짜 WORK 상태 입력 불가 (근무 시간 위조 방지)
- 미래 날짜 WORK 시도 시: "미래 날짜에는 정상근무를 입력할 수 없습니다." 에러 표시
- 오늘 날짜: WORK 포함 모든 상태 입력 가능

**HOLIDAY 상태 처리:**
- HOLIDAY는 직원 입력 폼에서 선택 불가 (관리자 전용 — Holiday 테이블 관리)
- 공휴일로 지정된 날짜에 직원이 WORK 기록 입력: 허용 (소방 업종 특성상 공휴일 현장 출동 가능)
- 달력에서 공휴일 날짜에 WORK 기록이 있으면 WORK 색상(#22C55E) 우선 표시

**세부 기능 정의:**

| 요소 | 설명 | 우선순위 |
|------|------|----------|
| 날짜 상태 선택 (Status) | 드롭다운 또는 라디오 버튼 | 필수 |
| 시작 시각 입력 | time picker (HH:mm) | WORK 상태 시 필수 |
| 종료 시각 입력 | time picker (HH:mm) | WORK 상태 시 필수 |
| 총 근무시간 자동 계산 | 종료 - 시작 자동 계산, 읽기 전용 표시 | 필수 |
| 업무 장소 선택 | 드롭다운 (사무실/현장/재택) + 직접입력 | WORK 상태 시 필수 |
| 업무 내용 입력 | textarea | 선택 |
| 저장 버튼 | 폼 제출 | 필수 |
| 삭제 버튼 | 기존 기록 삭제 (확인 모달) | 필수 (기록 있을 때) |
| 취소 버튼 | 달력으로 돌아가기 | 필수 |
| 유효성 검사 | 상태별 필수 필드 검사 | 필수 |
| 에러 메시지 | 각 필드별 인라인 에러 (섹션 14 참조) | 필수 |

**Status별 입력 필드 표시 규칙:**

| Status | 시작/종료 시각 | 업무 장소 | 업무 내용 |
|--------|--------------|----------|----------|
| WORK | 필수 표시 | 필수 표시 | 선택 표시 |
| SICK | 숨김 | 숨김 | 선택 표시 |
| ANNUAL | 숨김 | 숨김 | 선택 표시 |
| UNPAID | 숨김 | 숨김 | 선택 표시 |

**유효성 검사 규칙:**
- WORK 상태: startTime 필수
- WORK 상태: endTime 필수
- WORK 상태: location 필수
- WORK 상태: totalHours > 0 (서버사이드 계산 후 검증)
- WORK 상태 + 미래 날짜: 저장 불가 (서버사이드 거부)
- date 형식: YYYY-MM-DD (URL 파라미터), 서버사이드 유효성 검증

### 3.5 관리자 대시보드

**명시된 요구사항:**
- 전 직원 달력 조회 (날짜 클릭 시 해당 일자 전 직원 기록 표시)
- 기간 조회 (시작일 ~ 종료일 범위 선택)
- 직원별 집계 (기간 내 총 근무시간, 휴가/병가 일수 요약)

**[UC-003 해결] ADMIN이 /dashboard 접근 시 처리 방식 (확정):**
- ADMIN은 /admin 전용 대시보드 사용, /dashboard 접근 시 /admin 으로 리다이렉트
- ADMIN은 자신의 개인 근무 기록도 입력할 수 있음 → /admin/my-record/:date 별도 경로 제공
- 단, ADMIN도 WorkRecord를 가질 수 있음 (사장님이 현장 직원 겸하는 경우 대비)
- 미들웨어: ADMIN role + /dashboard 접근 → /admin 리다이렉트 처리

**세부 기능 정의:**

| 요소 | 설명 | 우선순위 |
|------|------|----------|
| 기간 날짜 선택기 | 시작일 ~ 종료일 date picker | 필수 |
| 직원별 집계 테이블 | 이름, 총 근무시간, 병가/연차/무급 일수 | 필수 |
| 날짜별 전 직원 기록 조회 | 날짜 선택 시 해당일 모든 직원 기록 | 필수 |
| 활성 직원 필터 | 비활성 직원 기본 포함 (필터로 제외 가능) | 권장 |
| 달력 뷰 (전 직원) | 월 달력에서 각 날짜에 기록 여부 표시 | 권장 |
| 공휴일 관리 | 공휴일 날짜 + 이름 등록/삭제 | 필수 |

**[UC-006 해결] 비활성 직원 기록 포함 정책 (확정):**
- 기본값: 비활성 직원 기록 포함 (기록은 영구 보존, 퇴직 후에도 세무 처리를 위해 필요)
- 관리자 UI 필터: 활성 직원만 보기 / 전체 보기 옵션 제공
- PDF 생성 시: 기본값으로 비활성 직원 기록 포함 (필터로 제외 가능)

**집계 항목 정의:**
- 총 근무시간: WORK 상태 레코드의 totalHours 합산 (Float, 소수점 2자리)
- 병가 일수: SICK 상태 레코드 수
- 유급휴가 일수: ANNUAL 상태 레코드 수
- 무급휴가 일수: UNPAID 상태 레코드 수
- 공휴일 일수: Holiday 테이블에서 해당 기간 공휴일 수 (WorkRecord와 별개 집계)

### 3.6 PDF 다운로드

**명시된 요구사항:**
- 선택 기간 전 직원의 날짜별 업무 내용 포함 PDF 생성
- @react-pdf/renderer 사용
- Noto Sans KR TTF 파일 직접 임베드 (한글 깨짐 방지)

**세부 기능 정의:**

| 요소 | 설명 | 우선순위 |
|------|------|----------|
| 기간 선택 | 시작일 ~ 종료일 | 필수 |
| PDF 생성 버튼 | 서버사이드 생성 후 다운로드 | 필수 |
| PDF 포함 내용 | 회사명, 생성일, 기간, 직원별 날짜별 기록 | 필수 |
| 집계 요약 페이지 | 직원별 총 근무시간, 휴가 일수 요약 | 필수 |
| 한글 폰트 내장 | Noto Sans KR TTF 임베드 | 필수 |
| 다운로드 파일명 | JunFire_{YYYY-MM}_{startDate}~{endDate}_report.pdf | 권장 |
| 로딩 상태 표시 | PDF 생성 중 스피너/진행 표시 | 권장 |

**[M-001 해결] PDF 레이아웃 상세 정의 (확정):**

**기본 설정:**
- 용지: A4 세로 (210mm × 297mm)
- 한글 폰트: Noto Sans KR TTF 내장
- 날짜 정렬: 오름차순 (오래된 날짜 → 최신 날짜)

**페이지 헤더 (전 페이지 공통):**
- 좌측: JunFire Protection
- 우측: 보고서 제목 (예: "2026년 5월 근무 기록")

**페이지 푸터 (전 페이지 공통):**
- 중앙: 페이지 번호 (X / Y 형식)

**1페이지: 표지**
- 상단 로고/회사명: JunFire Protection (대형 텍스트)
- 보고서 제목: "업무 기록 보고서"
- 보고서 기간: YYYY년 MM월 DD일 ~ YYYY년 MM월 DD일
- 생성일: YYYY년 MM월 DD일
- 생성자: 관리자 이름

**2페이지: 직원별 집계 요약**
- 테이블 컬럼: 직원명 | 총 근무시간 | 병가 일수 | 유급휴가 일수 | 무급휴가 일수
- 집계 방식: 선택 기간 내 합산
- 총 근무시간 표시: "162시간 30분" 형태 (Float → X시간 Y분 변환)
- 직원 정렬: 가나다순

**3페이지~: 직원별 상세 기록 (가나다순)**
- 섹션 헤더: 직원명 + 직책(role)
- 기간 요약: 총 근무일수, 총 근무시간, 각 휴가 일수
- 상세 테이블 컬럼 (순서 고정):
  1. 날짜 (YYYY-MM-DD, 요일 포함)
  2. 상태 (정상근무 / 병가 / 유급휴가 / 무급휴가 / 공휴일)
  3. 시작 시각 (HH:mm, WORK 시에만)
  4. 종료 시각 (HH:mm, WORK 시에만)
  5. 근무시간 (X시간 Y분, WORK 시에만)
  6. 업무 장소 (WORK 시에만)
  7. 업무 내용 (없으면 "-" 표시)
- 기록 없는 날짜: PDF에 포함하지 않음 (기록이 있는 날짜만 출력)
- 직원 구분: 새 직원마다 새 페이지 시작

**[UC-011 해결] 직원별 PDF 분리 출력 (확정):**
- 이번 버전: 전 직원 통합 PDF만 지원 (직원별 PDF 분리는 추후 요청 시 추가)

**[UC-005 해결] PDF 생성 최대 기간 제한 (확정):**
- 현재 5명 소규모로 최대 1년(365일) 범위까지 동기 처리 허용
- 30초 이내 생성 예상 (5명 × 365일 = 1,825건)
- 타임아웃: 60초로 설정. 초과 시 에러 응답

### 3.7 직원 계정 관리

**명시된 요구사항:**
- 직원 등록 / 수정 / 비활성화

**세부 기능 정의:**

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 직원 목록 조회 | 전체 직원 (활성/비활성 포함) | 필수 |
| 직원 등록 | 이름, 이메일, 초기 비밀번호 설정 | 필수 |
| 직원 정보 수정 | 이름, 이메일 수정 | 필수 |
| 계정 비활성화 | isActive=false (완전 삭제 아님) | 필수 |
| 계정 재활성화 | isActive=true | 필수 |
| 비밀번호 초기화 | 관리자가 임시 비밀번호 설정 + isFirstLogin=true 재설정 | 필수 |
| 계정 완전 삭제 | 소프트 삭제만 허용 (isActive=false) — 기록 보존 | 정책 확정 |

**[C-004 해결] 초기 비밀번호 전달 방식 (확정):**
- 직원 등록 완료 후 화면에 초기 비밀번호 1회 표시
- "이 비밀번호는 다시 확인할 수 없습니다. 반드시 메모하세요." 안내 문구 표시
- 직원이 최초 로그인 시 isFirstLogin=true → 비밀번호 변경 화면으로 강제 이동
- 변경 완료 시 isFirstLogin=false 업데이트

---

## 4. 비기능 요구사항

### 4.1 성능 (소규모 5명 기준)

| 항목 | 기준 |
|------|------|
| 동시 접속자 | 최대 5명 |
| 페이지 응답 시간 | 3초 이내 (일반 조회) |
| PDF 생성 시간 | 60초 이내 (1년치 기준), 타임아웃 설정 |
| DB 레코드 예상 규모 | 5명 × 365일 × 수년 = 수천~수만 건 (경량) |
| 서버 사양 요구 | 일반 VPS 또는 중고 서버로 충분 |

**성능 고려사항:**
- 소규모이므로 복잡한 캐싱 전략 불필요
- DB 인덱스: 섹션 4.4 인덱스 전략 참조
- PDF 생성은 동기 처리 가능 (소규모 데이터량)

### 4.2 보안

| 항목 | 요구사항 | 등급 |
|------|----------|------|
| 인증 | NextAuth.js JWT 세션 | 필수 |
| 비밀번호 | bcrypt 해시 저장 (cost factor 12) | 필수 |
| 비밀번호 정책 | 최소 8자, 2가지 이상 문자 조합 | 필수 |
| API 권한 검사 | 모든 API Route에 서버사이드 세션 검증 (섹션 3.1 표 참조) | 필수 |
| 타인 기록 접근 | 서버에서 userId 검증 (URL 조작 방어) | 필수 |
| 환경변수 | .env 파일 (git 미포함), PM2 env 적용 | 필수 |
| HTTPS | Nginx에서 SSL 처리 (Let's Encrypt) — 인터넷 노출 시 필수 | 필수 |
| SQL Injection | Prisma ORM 사용으로 자동 방어 | 필수 |
| XSS | Next.js 기본 보호 + 입력값 서버사이드 검증 | 필수 |

**[MINOR 해결] HTTPS 정책 확정:**
- 인터넷 노출 서버 운영 전제 → HTTPS는 권장이 아닌 필수
- Nginx + Let's Encrypt Certbot으로 무료 SSL 인증서 발급
- HTTP 접근 → HTTPS 자동 리다이렉트 설정

**[C-003 해결] 세션 타임아웃 정책:**
- 세션 유효 시간: 8시간 (업무 시간 동안 만료되지 않도록)
- 세션 만료 시: API 호출 → 401 응답 → 클라이언트에서 /login 리다이렉트
- 세션 연장: NextAuth의 updateSession() 활용 (사용자 활동 시 자동 연장 검토)

### 4.3 배포/운영 (자체 서버)

| 항목 | 내용 |
|------|------|
| 런타임 | Node.js + Next.js |
| 프로세스 관리 | PM2 |
| 리버스 프록시 | Nginx (HTTPS 처리 포함) |
| DB | PostgreSQL (자체 서버 설치) |
| 백업 | 일별 자동 백업 — 필수 (아래 백업 전략 참조) |
| 재시작 | .env 변경 시 pm2 restart 필요 |
| 모니터링 | PM2 logs / pm2 monit + pm2-logrotate |

**[M-005 해결] DB 백업 전략 (확정, 필수):**
- 백업 주기: 매일 자동 실행 (cron 설정)
- 백업 도구: pg_dump (PostgreSQL 내장)
- 백업 보관: 최근 30일 로컬 보관 (30일 초과 파일 자동 삭제)
- 백업 위치: 서버 로컬 디스크 + 외부 스토리지(USB/NAS) 주간 복사 권장
- 백업 파일명 형식: junfire_backup_YYYYMMDD.sql
- cron 설정 예: `0 2 * * * pg_dump -U postgres junfire_db > /backup/junfire_backup_$(date +%Y%m%d).sql`
- 복원 절차: `psql -U postgres junfire_db < junfire_backup_YYYYMMDD.sql`
- Prisma 마이그레이션 전 백업 의무화
- 등급: 필수 (노무/세무 증빙 자료 보존 의무)

**배포 프로세스 (간략):**
1. git pull → 코드 업데이트
2. npm run build → Next.js 빌드
3. prisma migrate deploy → DB 마이그레이션
4. pm2 restart → 서버 재시작

### 4.4 인덱스 전략

**[M-004 해결] WorkRecord 테이블 인덱스 (확정):**

| 인덱스 종류 | 컬럼 | 커버하는 쿼리 패턴 |
|-----------|------|-----------------|
| UNIQUE INDEX | (userId, date) | 중복 기록 방지 + 직원별 날짜 조회 |
| INDEX | (date) | 관리자 기간 조회 (전 직원 특정 기간) |
| INDEX | (userId) | 직원별 전체 기록 조회 |
| INDEX | (status) | 상태별 필터 조회 |

- PostgreSQL에서 UNIQUE 제약이 자동으로 복합 인덱스 생성됨 (userId, date)
- User 테이블: isActive 컬럼 인덱스 추가 권장 (활성 직원 필터 쿼리)
- Holiday 테이블: date UNIQUE 제약으로 자동 인덱스 생성

**Prisma 스키마 인덱스 선언 방향 (참고용 텍스트 명세):**
- WorkRecord: @@unique([userId, date]) + @@index([date]) + @@index([status])
- User: @@index([isActive])
- Holiday: date 필드에 @unique 선언

### 4.5 로그 관리 전략

**[MINOR 해결] 로그 관리:**
- PM2 로그 위치: ~/.pm2/logs/ (pm2-logrotate 설치 권장)
- pm2-logrotate 설정: 최대 파일 크기 10MB, 최대 10개 파일 보관
- Nginx 접근 로그: /var/log/nginx/access.log (기본)
- Nginx 에러 로그: /var/log/nginx/error.log
- Next.js 서버 에러: PM2 에러 로그에 자동 기록
- 문제 발생 시 확인 순서: 1) pm2 logs → 2) nginx 에러 로그 → 3) DB 접근 로그

### 4.6 한국어 UI/UX

| 항목 | 요구사항 |
|------|----------|
| UI 언어 | 한국어 전체 |
| 날짜 표시 | YYYY년 MM월 DD일 형식 |
| 시간 표시 | 24시간제 (HH:mm) |
| 숫자 포맷 | 한국식 (천 단위 콤마) |
| 에러 메시지 | 한국어 (섹션 14 참조) |
| PDF 폰트 | Noto Sans KR TTF 내장 |
| 타임존 | Asia/Seoul (UTC+9) |

---

## 5. 데이터 모델 상세 분석

### 5.1 User 테이블 (확정)

| 필드명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | String | PK, NOT NULL, cuid() | 고유 식별자 |
| email | String | UNIQUE, NOT NULL | 로그인 이메일 |
| name | String | NOT NULL | 직원 이름 |
| passwordHash | String | NOT NULL | bcrypt 해시 (필드명: password 아님) |
| role | Enum(EMPLOYEE, ADMIN) | NOT NULL, DEFAULT EMPLOYEE | 권한 역할 |
| isActive | Boolean | NOT NULL, DEFAULT true | 계정 활성 여부 (소프트 삭제) |
| isFirstLogin | Boolean | NOT NULL, DEFAULT true | 최초 로그인 강제 변경 여부 |
| createdAt | DateTime | NOT NULL, DEFAULT now() | 계정 생성일 |
| updatedAt | DateTime | NOT NULL | 최종 수정일 |

**비즈니스 규칙:**
- 비활성 사용자(isActive=false)는 로그인 불가
- 이메일은 변경 가능 (수정 시 중복 검사 필요 — 비활성 계정 포함)
- Admin은 초기 데이터 시딩 또는 별도 스크립트로 생성 (관리자 셀프 가입 불가)
- [UC-009 해결] 초기 관리자 계정: 배포 시 seed script (prisma db seed)로 생성

### 5.2 WorkRecord 테이블 (확정)

| 필드명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | String | PK, NOT NULL, cuid() | 고유 식별자 |
| userId | String | FK(User.id), NOT NULL | 기록 소유 직원 |
| date | DateTime (Date 타입) | NOT NULL | 근무 시작일 기준 (Asia/Seoul 기준 날짜만) |
| status | Enum(WORK, SICK, ANNUAL, UNPAID) | NOT NULL | 근무 상태 |
| startTime | DateTime | NULLABLE | 업무 시작 시각 (ISO 8601, KST) — WORK 시 필수 |
| endTime | DateTime | NULLABLE | 업무 종료 시각 (ISO 8601, KST) — WORK 시 필수 |
| totalHours | Float | NULLABLE | 총 근무시간 (단위: 시간, 소수점 2자리) — 서버 자동 계산 |
| location | String | NULLABLE | 업무 장소 — WORK 시 필수 |
| description | String | NULLABLE | 업무 내용 (선택) |
| createdBy | String | NOT NULL | 기록 생성자 ID (직원 또는 관리자) |
| updatedBy | String | NULLABLE | 마지막 수정자 ID (관리자 Admin Override 추적) |
| createdAt | DateTime | NOT NULL, DEFAULT now() | 기록 생성일 |
| updatedAt | DateTime | NOT NULL | 최종 수정일 |
| UNIQUE | (userId, date) | 복합 UNIQUE 제약 | 동일 직원 + 동일 날짜 중복 불가 |

**[C-001 해결] 야간 근무 처리 방식:**
- startTime, endTime: DateTime (ISO 8601) 타입 → 날짜+시각 모두 저장
- 야간 근무 예: startTime=2026-05-18T22:00:00+09:00, endTime=2026-05-19T06:00:00+09:00
- totalHours 자동 계산: (endTime - startTime) / 3600 = 8.0
- date 필드: 시작일 기준 (2026-05-18)
- UI에서 시작/종료 시각 HH:mm 입력 시, endTime < startTime이면 서버에서 endTime에 +1일 적용

**[C-005 해결] 중복 기록 UNIQUE 제약:**
- UNIQUE(userId, date) 제약 → 하루 1건 정책 확정
- 동일 날짜 2건 시도 → DB에서 409 Conflict 에러
- 소방 업종 하루 복수 업무 시나리오: description 필드에 전체 업무 내용 기술 (예: "오전 현장 출동(09:00-12:00), 오후 교육(14:00-17:00)")
- WORK 상태: 총 근무시간만 기록 (가장 긴 연속 근무 기준 또는 합산 후 description에 상세 기술)
- 근거: CLAUDE.md 요구사항에 "날짜별 1건" 구조로 일관되게 설계되어 있음

**[M-003 해결] totalHours 단위 및 계산:**
- DB 저장: Float (소수점 2자리, 단위: 시간) — 예: 8.5 = 8시간 30분
- 계산: (endTime - startTime) 밀리초 차이 / 3600000 = 시간 단위 Float
- UI 표시: Float → "X시간 Y분" 변환 함수 적용 (예: 8.5 → "8시간 30분")
- PDF 표시: 동일 변환 함수 적용
- 집계 합산: Float 덧셈 후 변환 (예: 8.5 + 7.5 = 16.0 → "16시간 0분")
- totalHours는 UI에서 읽기 전용 (자동 계산, 직접 입력 불가)

**비즈니스 검증:**
- status=WORK: startTime, endTime, location 필수
- status=SICK/ANNUAL/UNPAID: startTime, endTime, location null 허용
- HOLIDAY는 WorkRecord status에 없음 (Holiday 별도 테이블로 분리)
- date 필드: Asia/Seoul 기준 날짜만 저장 (PostgreSQL Date 타입)

### 5.3 Holiday 테이블 (신규 추가)

**[C-002 해결] Holiday 별도 테이블:**

| 필드명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | String | PK, NOT NULL, cuid() | 고유 식별자 |
| date | DateTime (Date 타입) | UNIQUE, NOT NULL | 공휴일 날짜 |
| name | String | NOT NULL | 휴일명 (예: "설날", "광복절") |
| createdBy | String | NOT NULL | 등록 관리자 ID |
| createdAt | DateTime | NOT NULL, DEFAULT now() | 등록일 |

**Holiday 테이블 설계 근거:**
- 공휴일은 전 직원 공통 → WorkRecord에 직원별로 5개 생성하는 비정규화 방지
- 달력 렌더링 시 Holiday 테이블 조회 → 해당 날짜 공휴일 표시
- 직원 WorkRecord에 HOLIDAY status 기록 없음 (Holiday 테이블이 단일 진실 공급원)
- 공휴일 날짜에 직원이 WORK 기록 가능 → WorkRecord 색상 우선 표시
- 공휴일 자동 연동 (한국 공휴일 API): 이번 버전 미구현 (관리자 수동 등록 방식)

**Status Enum 변경 (C-002 반영):**
- HOLIDAY를 WorkRecord.status에서 제거
- WorkRecord.status: WORK, SICK, ANNUAL, UNPAID (4가지)
- 공휴일 정보는 Holiday 테이블에서 별도 관리

### 5.4 엔티티 관계도 (텍스트 다이어그램)

```
┌─────────────────────────────────────┐
│               User                  │
├─────────────────────────────────────┤
│ id           : String (PK, cuid)    │
│ email        : String (UNIQUE)      │
│ name         : String               │
│ passwordHash : String               │
│ role         : EMPLOYEE | ADMIN     │
│ isActive     : Boolean              │
│ isFirstLogin : Boolean              │
│ createdAt    : DateTime             │
│ updatedAt    : DateTime             │
└──────────────┬──────────────────────┘
               │ 1
               │
               │ N
┌──────────────▼──────────────────────┐
│            WorkRecord               │
├─────────────────────────────────────┤
│ id          : String (PK, cuid)     │
│ userId      : String (FK → User.id) │
│ date        : Date (시작일 기준)     │
│ status      : WORK|SICK|ANNUAL|UNPAID│
│ startTime   : DateTime? (ISO 8601)  │
│ endTime     : DateTime? (ISO 8601)  │
│ totalHours  : Float? (자동 계산)    │
│ location    : String?               │
│ description : String?               │
│ createdBy   : String                │
│ updatedBy   : String?               │
│ createdAt   : DateTime              │
│ updatedAt   : DateTime              │
├─────────────────────────────────────┤
│ UNIQUE(userId, date)                │
│ INDEX(date)                         │
│ INDEX(status)                       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│             Holiday                 │
├─────────────────────────────────────┤
│ id        : String (PK, cuid)       │
│ date      : Date (UNIQUE)           │
│ name      : String                  │
│ createdBy : String (Admin ID)       │
│ createdAt : DateTime                │
└─────────────────────────────────────┘

Status Enum (WorkRecord 전용):
  WORK    - 정상근무
  SICK    - 병가
  ANNUAL  - 유급휴가
  UNPAID  - 무급휴가

Role Enum:
  EMPLOYEE - 일반 직원
  ADMIN    - 관리자
```

**관계 정의:**
- User 1 : WorkRecord N (한 직원이 여러 날짜의 기록을 가짐)
- 한 직원이 한 날짜에 하나의 기록만 가짐 (UNIQUE 제약)
- User 소프트 삭제(isActive=false) 시 WorkRecord 보존
- Holiday는 User와 직접 관계 없음 (전 직원 공통 적용)

---

## 6. 페이지별 상세 기능 정의

### 6.1 랜딩 페이지 (/)

**목적:** 회사 대문 역할, 시스템 진입점 제공

**UI 요소:**
- 헤더: JunFire Protection 로고/회사명
- 히어로 섹션: 서비스 설명 문구
- "로그인" 버튼 (CTA) → /login 이동
- 푸터: 회사 정보

**동작 규칙:**
- 비로그인 사용자: 페이지 정상 표시
- 로그인된 EMPLOYEE: /dashboard 자동 리다이렉트
- 로그인된 ADMIN: /admin 자동 리다이렉트

### 6.2 로그인 (/login)

**목적:** 사용자 인증

**UI 요소:**
- 이메일 입력 필드
- 비밀번호 입력 필드
- "로그인" 버튼
- 에러 메시지 영역

**동작 규칙:**
- 로그인 성공 + isFirstLogin=true: /change-password 강제 이동 (비밀번호 변경 페이지)
- 로그인 성공 + isFirstLogin=false:
  - EMPLOYEE → /dashboard
  - ADMIN → /admin
- 로그인 실패 시: 에러 메시지 표시 (섹션 14 참조)
- 비활성 계정 로그인 시도: "비활성화된 계정입니다. 관리자에게 문의하세요."

**유효성 검사:**
- 이메일: 이메일 형식 검사
- 비밀번호: 빈값 방지 (로그인 시 최소 1자 이상 — 정책 검증은 회원가입/변경 시)

### 6.3 직원 대시보드 (/dashboard)

**목적:** 직원의 월간 업무 기록 조회 및 입력 진입점

**UI 요소:**
- 헤더: 직원 이름, 로그아웃 버튼
- 월 네비게이션: 이전달 / 현재월 / 다음달 버튼
- 월 달력 그리드: 7열(월~일) × N행
- 각 날짜 셀: 날짜 번호 + 상태 색상 표시 (섹션 3.3 색상 코드 적용)
- 오늘 날짜 강조 표시 (ring-2 ring-blue-700 테두리)
- 월간 요약: 총 근무시간, 각 휴가 일수

**데이터 로딩:**
- 달력 렌더링 시: WorkRecord 조회(해당 월) + Holiday 조회(해당 월) 동시 호출
- 공휴일은 Holiday 테이블에서, 근무기록은 WorkRecord에서 각각 조회

**동작 규칙:**
- 초기 진입 시: 현재 월 표시, 오늘 날짜 포커스
- 날짜 클릭 시: /record/:date 이동
- 미기록 날짜 클릭: 신규 입력 폼
- 기록 있는 날짜 클릭: 수정 폼 (기존 데이터 로드)
- 과거 날짜 (오늘 이전): 정상 클릭 가능 (소급 입력 허용)

**접근 제어:**
- 미로그인 시: /login 리다이렉트
- ADMIN 접근 시: /admin 리다이렉트

### 6.4 기록 입력/수정 (/record/:date)

**목적:** 특정 날짜의 업무 기록 생성/수정/삭제

**URL 파라미터:**
- date: YYYY-MM-DD 형식 (예: 2026-05-18)
- 서버사이드 유효성 검증: 잘못된 날짜 → 400 Bad Request

**UI 요소:**
- 헤더: 날짜 표시 (YYYY년 MM월 DD일 (요일)), 뒤로가기 버튼
- Status 선택 (라디오 버튼): 정상근무 / 병가 / 유급휴가 / 무급휴가
- (WORK 선택 시) 시작 시각 입력 (time picker, HH:mm)
- (WORK 선택 시) 종료 시각 입력 (time picker, HH:mm)
- (WORK 선택 시) 총 근무시간 자동 표시 (읽기 전용)
- (WORK 선택 시) 업무 장소 선택 (드롭다운: 사무실/현장/재택/직접입력)
- 업무 내용 textarea (선택)
- 저장 버튼
- 삭제 버튼 (기존 기록이 있을 때만 표시)
- 취소 버튼

**동작 규칙:**
- 기존 기록 있음: 기존 값 폼에 채워서 수정 모드 (UPDATE)
- 기존 기록 없음: 빈 폼으로 신규 입력 모드 (CREATE)
- 수정 = 기존 레코드 UPDATE (새 레코드 INSERT 아님 — C-005 반영)
- Status 변경 시 WORK → 다른 상태: startTime, endTime, totalHours, location null 초기화
- 저장 성공 시: /dashboard 로 이동
- 삭제 성공 시: /dashboard 로 이동
- 취소 시: /dashboard 로 이동

**유효성 검사:**
- WORK 상태: startTime, endTime, location 필수
- WORK 상태 + 미래 날짜: 저장 불가 (서버에서 거부)
- date URL 파라미터 형식 및 유효한 날짜 검증

**접근 제어:**
- EMPLOYEE: 세션 userId 기준으로만 조회/저장 (타인 기록 접근 불가)
- ADMIN: /record/:date 접근 시 /admin 리다이렉트 (ADMIN은 /admin/my-record/:date 사용)

### 6.5 관리자 대시보드 (/admin)

**목적:** 전 직원 근무 현황 조회 진입점

**UI 요소:**
- 헤더: "관리자 대시보드", 직원 관리 버튼, 보고서 버튼, 공휴일 관리 버튼, 로그아웃 버튼
- 기간 선택: 시작일 ~ 종료일 date picker (기본: 현재 월)
- 직원별 집계 테이블: 이름, 총 근무시간, 병가/연차/무급 일수
- 날짜 선택 달력 또는 날짜별 드릴다운

**접근 제어:**
- ADMIN만 접근 가능 (서버사이드 세션 검증)
- EMPLOYEE 접근 시: /dashboard 리다이렉트

### 6.6 직원 관리 (/admin/staff)

**목적:** 직원 계정 등록/수정/비활성화

**UI 요소:**
- 직원 목록 테이블: 이름, 이메일, 역할, 상태, 액션 버튼
- 직원 추가 버튼 → 입력 폼
- 직원별 수정/비활성화/비밀번호 초기화 버튼

**동작 규칙:**
- 직원 추가: 이름, 이메일, 초기 비밀번호 입력 → 저장 완료 후 초기 비밀번호 1회 표시
- 직원 수정: 이름, 이메일 수정 가능
- 비활성화: 확인 후 isActive=false
- 재활성화: isActive=true
- 비밀번호 초기화: 임시 비밀번호 설정 + isFirstLogin=true 재설정

**유효성 검사:**
- 이메일: 형식 검사 + 중복 검사 (비활성 계정 포함)
- 이름: 필수, 최소 1자
- 비밀번호: 최소 8자, 2가지 이상 문자 조합

### 6.7 보고서/PDF (/admin/report)

**목적:** 기간별 전 직원 근무 기록 PDF 다운로드

**UI 요소:**
- 기간 선택: 시작일 ~ 종료일 date picker
- 비활성 직원 포함 옵션 (기본값: 포함)
- "PDF 다운로드" 버튼
- 생성 중 로딩 표시

**동작 규칙:**
- PDF 다운로드 버튼 클릭 시: 서버사이드 PDF 생성 → 파일 다운로드
- 생성 중 버튼 비활성화 (중복 클릭 방지)
- 다운로드 완료 시: 자동 다운로드

**에러 처리:**
- 기간 내 데이터 없음: "선택한 기간에 기록이 없습니다."
- PDF 생성 실패: "PDF 생성에 실패했습니다. 다시 시도해 주세요."
- 타임아웃 (60초 초과): 에러 메시지 + 재시도 안내

---

## 7. 비즈니스 규칙 정의 (20개 이상 확정)

### 날짜 상태별 유효성 규칙

| 규칙 ID | 상태 | 조건 | 처리 |
|---------|------|------|------|
| BR-001 | WORK | startTime, endTime, location 모두 필수 | 미입력 시 저장 불가 |
| BR-002 | WORK | totalHours > 0 | 서버사이드 자동 계산 후 검증 |
| BR-003 | WORK | totalHours = (endTime - startTime) 자동 계산 | 서버사이드 계산, UI 읽기 전용 |
| BR-004 | SICK / ANNUAL / UNPAID | startTime, endTime, location null 허용 | 입력 필드 숨김 |
| BR-005 | 모든 상태 | description 선택 입력 | null 허용 |
| BR-006 | 모든 상태 | 동일 userId + date 중복 불가 | 409 Conflict 에러 |
| BR-007 | WORK + 미래 날짜 | 미래 날짜 WORK 상태 저장 불가 | 서버사이드 거부, 에러 메시지 |
| BR-008 | SICK/ANNUAL/UNPAID + 미래 날짜 | 미래 날짜 휴가 상태 저장 허용 | 정상 처리 |

### 수정/삭제 규칙

| 규칙 ID | 조건 | 허용 | 비고 |
|---------|------|------|------|
| BR-009 | EMPLOYEE 자신의 기록 | 수정 O, 삭제 O | userId 서버 검증 필수 |
| BR-010 | EMPLOYEE 타인의 기록 | 수정 X, 삭제 X | 403 반환 |
| BR-011 | ADMIN 모든 직원 기록 | 읽기 O, 누락 기록 대리 입력 O | Admin Override: updatedBy에 관리자 ID 기록 |
| BR-012 | ADMIN 직원 기록 수정 | 직원 누락분 대리 입력만 허용 | 일반 수정은 불가 — updatedBy 필드로 추적 |
| BR-013 | 기록 수정 | 기존 레코드 UPDATE | 새 레코드 INSERT 아님 (중복 방지) |
| BR-014 | 비활성 직원 기록 | 조회/PDF 포함 | isActive=false 여도 기록 보존 |

### 야간 근무 규칙

| 규칙 ID | 조건 | 처리 |
|---------|------|------|
| BR-015 | endTime(HH:mm) < startTime(HH:mm) | endTime에 +1일 자동 적용 (자정 초과 야간 근무) |
| BR-016 | 야간 근무 date | 시작일 기준으로 WorkRecord.date 저장 |
| BR-017 | 야간 근무 totalHours | (endTime - startTime) 정상 계산 (DateTime 타입으로 음수 발생 없음) |

### PDF 포함 항목 규칙

| 규칙 ID | 항목 | 포함 여부 |
|---------|------|----------|
| BR-018 | 회사명 (JunFire Protection) | 필수 포함 |
| BR-019 | 보고서 생성일 | 필수 포함 |
| BR-020 | 조회 기간 | 필수 포함 |
| BR-021 | 직원별 날짜별 상태 | 필수 포함 |
| BR-022 | WORK 상태 시작/종료 시각 | 필수 포함 |
| BR-023 | 업무 내용 (description) | 포함 (null이면 "-" 표시) |
| BR-024 | 직원별 집계 요약 | 필수 포함 |
| BR-025 | 비활성 직원 기록 | 기본 포함, 필터로 제외 가능 |
| BR-026 | 기록 없는 날짜 | PDF에 미포함 (기록 있는 날짜만 출력) |

---

## 8. 기술 스택 선택 근거

| 기술 | 선택 이유 | 위험요소 |
|------|----------|----------|
| **Next.js 14 (App Router)** | 프론트+백엔드 단일 프레임워크로 자체 서버 운영 복잡도 감소. | App Router 학습 곡선 |
| **Tailwind CSS** | 빠른 UI 개발, 반응형 지원. hex 코드 직접 사용 가능 | 초기 클래스명 학습 필요 |
| **PostgreSQL** | 안정적, 자체 서버 운영에 적합, ACID 보장. Date 타입 지원 | 직접 설치/관리 필요 |
| **Prisma** | 타입 안전한 ORM, 마이그레이션 편의성, @@unique/@@index 선언 지원 | 마이그레이션 실수 시 데이터 손실 위험 |
| **NextAuth.js** | Credentials Provider로 이메일/비밀번호 지원. JWT 세션 | NEXTAUTH_SECRET 환경변수 필수 |
| **@react-pdf/renderer** | 한국어 폰트 내장 가능. Node.js 서버사이드 렌더링 지원 | Noto Sans KR TTF 파일 번들 크기 증가 |
| **PM2 + Nginx** | 검증된 Node.js 프로세스 관리 + 리버스 프록시 | .env 변경 시 수동 restart 필요 |

---

## 9. 엣지 케이스 목록 (12개 이상)

| ID | 케이스 | 발생 조건 | 처리 방안 |
|----|--------|----------|----------|
| EC-001 | 세션 만료 중 폼 입력 후 저장 시도 | 장시간 폼 작성 중 세션 만료 (8시간 세션으로 위험 감소) | 저장 실패 시 "로그인이 필요합니다." + /login 리다이렉트 |
| EC-002 | 동일 날짜 중복 기록 생성 시도 | 여러 탭에서 동시 저장 | DB UNIQUE 제약 → 409 에러 → "해당 날짜에 이미 기록이 존재합니다." |
| EC-003 | WORK → SICK 상태 변경 시 시간 데이터 처리 | 기존 WORK 기록 수정으로 SICK으로 변경 | startTime, endTime, totalHours, location null 초기화 (UPDATE) |
| EC-004 | 야간 근무 (예: 22:00 ~ 06:00) | 소방 현장 출동 야간 업무 | [해결] DateTime 타입 + 다음날 날짜 자동 적용 → totalHours 정상 계산 |
| EC-005 | 유효하지 않은 날짜 URL 파라미터 | /record/2026-13-45 등 잘못된 날짜 | 서버사이드 date 유효성 검증 → 400 Bad Request |
| EC-006 | 직원 비활성화 후 기존 기록 조회 | 관리자가 퇴직 직원 계정 비활성화 | 기존 기록 보존, 기간 조회/PDF에 기본 포함 (필터로 제외 가능) |
| EC-007 | 관리자 계정이 /dashboard 접근 | ADMIN이 직원 대시보드 URL 직접 입력 | 미들웨어에서 /admin 리다이렉트 |
| EC-008 | EMPLOYEE가 타인 기록 API 직접 호출 | userId 파라미터 조작 시도 | 서버에서 세션 userId로만 조회/저장 → 403 반환 |
| EC-009 | 기간 조회 시 기간이 매우 긴 경우 (1년+) | 관리자가 수년치 PDF 생성 요청 | 60초 타임아웃 설정, 실패 시 에러 메시지 |
| EC-010 | 신규 직원 등록 시 비활성 계정과 이메일 중복 | 비활성화된 계정과 동일 이메일 | 비활성 계정 포함 중복 검사 → "이미 사용 중인 이메일입니다." (재활성화 안내 추가) |
| EC-011 | PDF 생성 중 서버 재시작 | PM2 restart 중 PDF 요청 | PM2 graceful shutdown 설정. 생성 실패 → 재시도 안내 |
| EC-012 | 모든 직원이 미기록인 기간 PDF 생성 | 데이터 없는 기간 조회 | "선택한 기간에 기록이 없습니다." 메시지, PDF 생성 안 함 |
| EC-013 | 공휴일 날짜에 직원이 WORK 기록 입력 | 소방 현장 출동 공휴일 근무 | 허용 — WorkRecord WORK 상태로 저장, 달력에 WORK 색상 우선 표시 |
| EC-014 | 최초 로그인 강제 변경 중 세션 만료 | 비밀번호 변경 페이지에서 세션 만료 | /login 리다이렉트, 재로그인 후 다시 강제 변경 |
| EC-015 | ADMIN이 직원 기록 누락분 대리 입력 | 직원이 기록 안 한 날짜 관리자 입력 | updatedBy 필드에 관리자 ID 저장 (감사 추적) |

---

## 10. 리스크 및 제약사항

### 기술 리스크

| ID | 리스크 | 발생 가능성 | 영향도 | 대응 방안 |
|----|--------|-----------|--------|----------|
| RS-001 | PDF 한글 폰트 깨짐 | 높음 | 높음 | Noto Sans KR TTF 파일 @react-pdf/renderer에 직접 임베드 필수. 개발 초기 PDF 렌더링 테스트 선행 |
| RS-002 | 날짜/시간 타임존 혼용 | 높음 | 높음 | 서버·DB·클라이언트 모두 Asia/Seoul 명시. startTime/endTime DateTime 타입 사용 |
| RS-003 | Prisma 마이그레이션 실수로 데이터 손실 | 중간 | 매우 높음 | 운영 DB는 migrate deploy만 사용. 마이그레이션 전 DB 백업 필수 |
| RS-004 | NextAuth 세션 설정 오류 | 중간 | 높음 | NEXTAUTH_SECRET 환경변수 필수. 세션 전략 JWT 고정. 세션 만료 시간 8시간 |
| RS-005 | 야간 근무 시간 계산 오류 | 낮음 | 중간 | [해결] DateTime 타입 사용으로 자정 초과 자동 처리. 서버사이드 테스트 필수 |
| RS-006 | PDF 생성 타임아웃 | 낮음 | 중간 | 60초 타임아웃 설정. 현재 5명 소규모이므로 즉각적 문제 없음 |

### 운영 리스크

| ID | 리스크 | 대응 방안 |
|----|--------|----------|
| RS-007 | 자체 서버 단일 장애점 | 일별 pg_dump 백업 (필수), 외부 스토리지 주간 복사, 장애 대응 매뉴얼 |
| RS-008 | .env 파일 분실/노출 | git .gitignore에 .env 포함. 서버 환경변수 별도 관리 |
| RS-009 | PM2 재시작 시 진행 중 요청 유실 | graceful shutdown 설정 |
| RS-010 | 직원이 실수로 다른 날짜 기록 덮어쓰기 | URL의 날짜가 폼 헤더에 명확히 표시. 저장 전 날짜 확인 |

### 제약사항

| 항목 | 제약 |
|------|------|
| 직원 수 | 최대 5명 (현재). 확장 가능성 고려한 설계 |
| 서버 | 자체 운영 → 클라우드 관리형 서비스 없음 |
| 인터넷 노출 | 인터넷 노출 전제 → HTTPS 필수 |
| 개발 인력 | 1인 개발 가능성 → 복잡도 최소화 |
| 모바일 지원 | 최소 375px 지원, 달력 셀 44px 터치 영역 보장 |

---

## 11. 확정된 항목 목록 (구 미확정 항목 해소)

| 구 ID | 항목 | 결정 |
|-------|------|------|
| UC-001 | 미래 날짜 기록 입력 허용 여부 | SICK/ANNUAL/UNPAID 허용, WORK 불가 |
| UC-002 | ADMIN이 직원 기록 수정/삭제 가능 여부 | 누락분 대리 입력만 허용, updatedBy 추적 |
| UC-003 | ADMIN이 /dashboard 접근 시 처리 | /admin 리다이렉트 확정 |
| UC-004 | 야간 근무(자정 초과) 지원 여부 | 지원 확정 — DateTime 타입으로 자동 처리 |
| UC-005 | PDF 생성 최대 기간 제한 여부 | 최대 1년, 60초 타임아웃 |
| UC-006 | 비활성 직원 기록의 PDF 포함 여부 | 기본 포함, 필터로 제외 가능 |
| UC-007 | 공휴일(HOLIDAY) 지정 방식 | Holiday 별도 테이블, 관리자 수동 등록, 자동 API 연동 미구현 |
| UC-008 | 직원 계정 완전 삭제 허용 여부 | 소프트 삭제만 허용 (isActive=false), 기록 영구 보존 |
| UC-009 | 초기 관리자 계정 생성 방식 | prisma db seed 스크립트로 배포 시 생성 |
| UC-010 | 모바일 반응형 지원 범위 | 최소 375px, 44px 터치 영역, Tailwind sm/md 브레이크포인트 |
| UC-011 | 직원별 PDF 분리 출력 | 전 직원 통합 PDF만 (분리 출력은 추후 요청 시) |
| UC-012 | 총 근무시간 계산 단위 | Float (소수점 2자리, 단위: 시간), UI는 "X시간 Y분" 변환 표시 |

---

## 12. 구현 우선순위 매트릭스

### 1단계: 핵심 기반 (Must-Have)

| 순위 | 기능 | 이유 |
|------|------|------|
| 1 | DB 스키마 (Prisma) 설계 + 마이그레이션 | 모든 기능의 기반 (User, WorkRecord, Holiday 3개 테이블) |
| 2 | NextAuth 인증 (로그인/로그아웃) | 모든 기능에 인증 필요 |
| 3 | 미들웨어 (Route 보호, Role 검증) | 보안 기반 |
| 4 | 직원 대시보드 (달력 뷰 + 색상) | 핵심 사용자 기능 |
| 5 | 업무 기록 입력/수정/삭제 | 핵심 데이터 입력 |

### 2단계: 핵심 관리자 기능 (Must-Have)

| 순위 | 기능 | 이유 |
|------|------|------|
| 6 | 관리자 대시보드 (기간 조회 + 집계) | 관리자 핵심 업무 |
| 7 | PDF 다운로드 (레이아웃 확정 기준) | 관리자 주요 요구사항 |
| 8 | 직원 계정 관리 | 운영 필수 기능 |
| 9 | 공휴일 관리 (Holiday 테이블 CRUD) | 달력 렌더링 필수 |

### 3단계: 품질 개선 (Should-Have)

| 순위 | 기능 | 이유 |
|------|------|------|
| 10 | 반응형 UI (모바일, 375px 기준) | 현장 직원 접근성 |
| 11 | 랜딩 페이지 완성도 | 프로페셔널 인상 |
| 12 | 에러 처리 고도화 | 안정적 운영 |

### 4단계: 추가 개선 (Nice-to-Have)

| 순위 | 기능 | 이유 |
|------|------|------|
| 13 | 세션 만료 시 입력 데이터 임시 저장 | 사용자 편의 (보안 검토 필요) |
| 14 | 직원별 월간 요약 통계 | 직원 자기 관리 |
| 15 | 직원별 PDF 분리 출력 | 추후 요청 대응 |
| 16 | 공휴일 자동 달력 API 연동 | 관리 편의 |

---

## 13. 달력 색상 코드 확정

| 상태 | Tailwind 클래스 | Hex 코드 | 표시 조건 |
|------|----------------|---------|---------|
| WORK (기록 있음) | bg-green-500 | #22C55E | WorkRecord.status = WORK |
| 미입력 (과거, 기록 없음) | bg-red-500 | #EF4444 | 오늘 이전 날짜 + WorkRecord 없음 |
| SICK | bg-yellow-500 | #EAB308 | WorkRecord.status = SICK |
| ANNUAL | bg-blue-500 | #3B82F6 | WorkRecord.status = ANNUAL |
| UNPAID | bg-gray-500 | #6B7280 | WorkRecord.status = UNPAID |
| HOLIDAY | bg-purple-500 | #8B5CF6 | Holiday 테이블에 해당 날짜 존재 |
| 미래 날짜 (기록 없음) | bg-white | #FFFFFF | 오늘 이후 날짜 + WorkRecord 없음 |
| 오늘 날짜 강조 | ring-2 ring-blue-700 | 테두리 강조 | 다른 배경색 위에 중첩 적용 |

**우선순위 규칙 (중첩 시):**
1. WorkRecord 상태가 있으면 → WorkRecord 색상 우선
2. Holiday 테이블에 날짜 존재 + WorkRecord 없음 → HOLIDAY 보라색
3. 과거 날짜 + 기록 없음 → 빨간색 (미입력 경고)
4. 미래 날짜 + 기록 없음 → 흰색 (기본)
5. 오늘 날짜 → 위 색상 + ring-2 ring-blue-700 테두리 중첩

---

## 14. 에러 메시지 목록 (한국어)

| 상황 | 에러 메시지 | 표시 위치 |
|------|-----------|---------|
| 로그인 실패 (이메일/비밀번호 불일치) | "이메일 또는 비밀번호가 올바르지 않습니다." | 로그인 폼 하단 |
| 비활성 계정 로그인 시도 | "비활성화된 계정입니다. 관리자에게 문의하세요." | 로그인 폼 하단 |
| 세션 만료 / 미인증 접근 | "로그인이 필요합니다." | 페이지 또는 토스트 |
| 권한 없음 (403) | "접근 권한이 없습니다." | 페이지 또는 토스트 |
| 필수 입력 누락: 시작 시각 | "근무 시작 시간을 입력해주세요." | 필드 하단 인라인 |
| 필수 입력 누락: 종료 시각 | "근무 종료 시간을 입력해주세요." | 필드 하단 인라인 |
| 필수 입력 누락: 업무 장소 | "업무 장소를 선택해주세요." | 필드 하단 인라인 |
| 중복 기록 시도 | "해당 날짜에 이미 기록이 존재합니다." | 저장 실패 토스트 |
| 미래 날짜 WORK 입력 시도 | "미래 날짜에는 정상근무를 입력할 수 없습니다." | 저장 실패 토스트 |
| 잘못된 날짜 URL 파라미터 | "잘못된 날짜입니다." | 페이지 또는 리다이렉트 |
| 이메일 중복 (직원 등록) | "이미 사용 중인 이메일입니다." | 폼 필드 하단 인라인 |
| 비밀번호 정책 위반 | "비밀번호는 8자 이상, 영문과 숫자 또는 특수문자를 포함해야 합니다." | 폼 필드 하단 인라인 |
| 서버 오류 (500) | "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요." | 토스트 |
| PDF 생성 실패 | "PDF 생성에 실패했습니다. 다시 시도해 주세요." | 토스트 |
| 기간 내 기록 없음 (PDF) | "선택한 기간에 기록이 없습니다." | 토스트 |
| 저장 실패 (일반) | "저장에 실패했습니다. 다시 시도해 주세요." | 토스트 |

---

## 15. 자기검토 체크리스트 (97% 기준)

| # | 검토 항목 | 결과 |
|---|----------|------|
| 1 | CRITICAL 5개 전부 해결 | 완료 (C-001~C-005 모두 섹션 내 명확 정의) |
| 2 | MAJOR 10개 전부 해결 | 완료 (M-001~M-010 모두 해결) |
| 3 | MINOR 5개 전부 반영 | 완료 (로그관리, HTTPS, 비활성직원, 미래날짜, 에러메시지) |
| 4 | 데이터 모델 완전성 | 완료 (User, WorkRecord, Holiday 3개 테이블 + 전 필드 정의) |
| 5 | 비즈니스 규칙 수 | 완료 (BR-001~BR-026, 26개) |
| 6 | 엣지 케이스 수 | 완료 (EC-001~EC-015, 15개) |
| 7 | 보안 요구사항 | 완료 (API 레벨 테이블, URL 조작 방지, 비밀번호 정책 모두 포함) |
| 8 | PDF 레이아웃 | 완료 (표지, 집계요약, 상세기록, 헤더/푸터, 컬럼 순서 모두 정의) |
| 9 | 에러 메시지 | 완료 (16개 한국어 메시지 정의) |
| 10 | 달력 색상 | 완료 (8가지 상태 + hex 코드 + Tailwind 클래스 + 우선순위 규칙) |
| 11 | 배포/운영 | 완료 (DB 백업 필수 + cron 설정 예시 + HTTPS 필수 + 로그 전략) |
| 12 | UC 항목 | 완료 (UC-001~UC-012 전부 확정, 사용자 확인 필요 항목 0개) |

---

*분석 완료 (V2): 2026-05-18*
*Critic Review V1 피드백 전체 반영 — CRITICAL 5개, MAJOR 10개, MINOR 5개 해결*
*다음 단계: PLAN.md 작성 (planner 에이전트)*
