// src/types/index.ts
// 목적: JunFire Protection 전체 공유 TypeScript 타입 정의
// 모든 컴포넌트, API Route, 유틸에서 이 파일의 타입을 임포트하여 사용

// ===== 열거형 타입 =====

// 사용자 역할 — Prisma Role enum과 동일
export type Role = 'EMPLOYEE' | 'ADMIN'

// 업무 기록 상태 — Prisma RecordStatus enum과 동일
export type RecordStatus = 'WORK' | 'SICK' | 'ANNUAL' | 'UNPAID' | 'HOLIDAY'

// ===== 한국어 표시명 매핑 상수 =====

// 업무 기록 상태 한국어 표시명 (달력 셀, PDF 등에서 사용)
export const StatusLabel: Record<RecordStatus, string> = {
  WORK: '정상근무',
  SICK: '병가',
  ANNUAL: '연차',
  UNPAID: '무급',
  HOLIDAY: '공휴일',
}

// Role 한국어 표시명 — PDF 생성 시 한국어 매핑 (NF-V2-004)
export const RoleLabel: Record<Role, string> = {
  EMPLOYEE: '직원',
  ADMIN: '관리자',
}

// ===== 상태별 색상 상수 (RESEARCH.md hex 코드 기준) =====

// 달력 셀 배경색 — Tailwind className 형식
export const StatusColor: Record<RecordStatus, string> = {
  WORK: '#D1FAE5',    // 초록 계열 — 정상근무
  SICK: '#FEE2E2',    // 빨강 계열 — 병가
  ANNUAL: '#DBEAFE',  // 파랑 계열 — 연차
  UNPAID: '#F3F4F6',  // 회색 계열 — 무급
  HOLIDAY: '#FEF3C7', // 노랑 계열 — 공휴일
}

// ===== DTO (Data Transfer Object) 타입 =====

// 직원 DTO — API 응답 시 사용 (passwordHash 제외)
export interface UserDTO {
  id: string
  username: string
  name: string
  role: Role
  isActive: boolean      // 소프트 삭제 플래그
  isFirstLogin: boolean  // 최초 로그인 여부
  createdAt: string      // ISO 8601 문자열
}

// 업무 기록 DTO — API 응답 시 사용
export interface WorkRecordDTO {
  id: string
  userId: string
  date: string                // YYYY-MM-DD
  status: RecordStatus
  startTime: string | null    // ISO 8601 UTC (표시 시 KST 변환)
  endTime: string | null      // ISO 8601 UTC
  totalHours: number | null   // Float (소수점 2자리)
  location: string | null     // 업무 장소 — WORK 시 필수
  description: string | null  // 업무 내용 — 선택
  createdBy: string           // 기록 생성자 ID
  updatedBy: string | null    // 마지막 수정자 ID (관리자 대리 입력 추적)
  createdAt: string
  updatedAt: string
  user?: Pick<UserDTO, 'id' | 'name' | 'username' | 'role'>  // JOIN 시 포함 (관리자 조회용)
}

// 직원별 기간 집계 DTO — 관리자 집계 테이블용
export interface EmployeeSummaryDTO {
  userId: string
  name: string
  username: string
  workDays: number       // WORK 일수
  sickDays: number       // SICK 일수
  annualDays: number     // ANNUAL 일수
  holidayDays: number    // HOLIDAY 일수
  unpaidDays: number     // UNPAID 일수 (집계 제외)
  workActualHours: number  // WORK 실제 입력 시간 합계
  totalHours: number     // workActualHours + (sick+annual+holiday)×8
}

// 업무 현장 DTO — API 응답 시 사용
export interface WorkLocationDTO {
  id: string
  name: string
  isActive: boolean
  createdBy: string
  createdAt: string
}

// 공휴일 DTO — API 응답 시 사용
export interface HolidayDTO {
  id: string
  date: string    // YYYY-MM-DD
  name: string    // 휴일명 (예: "설날", "광복절")
  createdBy: string
  createdAt: string
}

// ===== Cursor 기반 페이징 타입 (offset 절대 금지) =====

// 페이징 요청 인풋 — 쿼리 파라미터로 전달
export interface CursorPaginationInput {
  cursor?: string  // 마지막 레코드의 id (없으면 첫 페이지부터)
  take: number     // 가져올 건수
}

// 페이징 응답 결과 제네릭 타입
export interface CursorPaginationResult<T> {
  data: T[]
  nextCursor: string | null  // 다음 페이지 cursor (null이면 마지막 페이지)
  hasMore: boolean
}

// 공통 API 응답 래퍼 — 모든 API Route의 응답 형식
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ===== 입력 요청 타입 =====

// 업무 기록 생성 요청 — POST /api/records body
export interface CreateRecordInput {
  date: string          // YYYY-MM-DD
  status: RecordStatus
  startTime?: string    // HH:mm (UI 입력, WORK 시 필수)
  endTime?: string      // HH:mm (UI 입력, WORK 시 필수)
  location?: string     // 업무 장소 (WORK 시 필수)
  description?: string  // 업무 내용 (선택)
}

// 업무 기록 수정 요청 — PUT /api/records/[id] body
export interface UpdateRecordInput extends Partial<CreateRecordInput> {
  id: string
}

// 관리자 대리 입력 요청 — POST /api/admin/records/override body (NF-001)
export interface AdminOverrideInput extends CreateRecordInput {
  targetUserId: string  // 대리 입력 대상 직원 ID
}

// ===== UI 렌더링용 타입 =====

// 달력 셀 렌더링용 날짜 데이터
export interface CalendarDayData {
  date: string                    // YYYY-MM-DD
  record: WorkRecordDTO | null    // 해당 날짜 업무 기록 (없으면 null)
  isHoliday: boolean              // 공휴일 여부
  holidayName: string | null      // 공휴일 이름
  isToday: boolean                // 오늘 날짜 여부 (KST 기준)
  isFuture: boolean               // 미래 날짜 여부 (기록 입력 비활성화용)
}

// PDF 생성 요청 타입 — POST /api/admin/report body
export interface GenerateReportInput {
  startDate: string          // YYYY-MM-DD
  endDate: string            // YYYY-MM-DD
  includeInactive: boolean   // 비활성화 직원 포함 여부
}

// 도면 게시판 DTO — API 응답 시 사용
export interface DrawingDTO {
  id: string
  siteName: string    // 현장명
  floor: string       // 층
  fileName: string    // 원본 파일명 (표시용)
  fileSize: number    // 파일 크기 (bytes)
  createdBy: string   // 등록 관리자 ID
  createdAt: string   // ISO 8601 문자열
}
