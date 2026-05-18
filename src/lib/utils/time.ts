// src/lib/utils/time.ts
// 목적: 시간 계산 및 KST/UTC 변환 유틸 — date-fns-tz 기반
// [C-001 CRITICAL] setHours/setMinutes 등 로컬 타임존 의존 메서드 사용 금지
// 운영 서버(UTC 환경)에서 setHours 사용 시 9시간 오차 발생 — fromZonedTime만 사용

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

// KST 타임존 상수 — 이 파일 전체에서 반드시 이 상수만 사용 (직접 문자열 금지)
export const TIMEZONE = 'Asia/Seoul'

/**
 * 오늘 날짜를 KST 기준 YYYY-MM-DD 문자열로 반환
 * [C-001] formatInTimeZone 사용 — UTC 서버 환경에서도 KST 기준 오늘 날짜 보장
 */
export function getTodayKST(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd')
}

/**
 * [C-001] HH:mm 문자열을 UTC DateTime으로 변환 (DB 저장용)
 * - fromZonedTime으로 KST → UTC 명시적 변환 (setHours 절대 불사용)
 * - 야간 근무 종료 시각: isNightShiftEnd=true 전달 시 날짜 +1일 처리
 * @param dateStr YYYY-MM-DD (KST 기준 날짜)
 * @param timeStr HH:mm
 * @param isNightShiftEnd 야간 근무 종료 시각 여부 (기본값 false)
 * @returns UTC Date 객체 (DB 저장용 ISO 8601)
 */
export function toUTCDateTime(
  dateStr: string,
  timeStr: string,
  isNightShiftEnd = false
): Date {
  if (isNightShiftEnd) {
    // +1일 날짜 계산 — UTC 기준으로 하루 추가 (로컬 타임존 의존 없음)
    const base = new Date(`${dateStr}T00:00:00Z`)
    base.setUTCDate(base.getUTCDate() + 1)
    const nextDateStr = base.toISOString().slice(0, 10)
    return fromZonedTime(`${nextDateStr}T${timeStr}:00`, TIMEZONE)
  }
  return fromZonedTime(`${dateStr}T${timeStr}:00`, TIMEZONE)
}

/**
 * [C-001] startTime/endTime으로 totalHours 계산
 * - fromZonedTime으로 KST → UTC 변환 후 밀리초 차이 계산
 * - 야간 근무 자동 감지: endTime < startTime이면 다음날로 처리
 * - [NF-V2-004] startTime === endTime이면 0 반환 (24시간 기록 방지)
 * @param dateStr YYYY-MM-DD (근무 시작일, KST 기준)
 * @param startTimeStr HH:mm
 * @param endTimeStr HH:mm
 * @returns totalHours (Float, 소수점 2자리) — 0 반환 시 API 레이어에서 거부
 */
export function calcTotalHours(
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string
): number {
  // KST ISO 문자열 생성 후 UTC로 변환 — setHours 미사용
  const startISO = `${dateStr}T${startTimeStr}:00`
  const startUTC = fromZonedTime(startISO, TIMEZONE)

  let endISO = `${dateStr}T${endTimeStr}:00`
  let endUTC = fromZonedTime(endISO, TIMEZONE)

  const diff = endUTC.getTime() - startUTC.getTime()

  // [NF-V2-004] 동일 시각 입력 시 0 반환 후 API 레이어에서 totalHours <= 0 검증으로 거부
  if (diff === 0) return 0

  // 야간 근무: 종료 UTC가 시작 UTC보다 이전(diff < 0)이면 날짜 +1일
  if (diff < 0) {
    const nextDayBase = new Date(startUTC)
    nextDayBase.setUTCDate(nextDayBase.getUTCDate() + 1)
    const nextDateStr = nextDayBase.toISOString().slice(0, 10)
    endISO = `${nextDateStr}T${endTimeStr}:00`
    endUTC = fromZonedTime(endISO, TIMEZONE)
  }

  // 밀리초 차이를 시간 단위로 변환 후 소수점 2자리로 반올림
  const diffMs = endUTC.getTime() - startUTC.getTime()
  const hours = diffMs / (1000 * 60 * 60)
  return Math.round(hours * 100) / 100
}

/**
 * Float 시간 값을 한국어 "X시간 Y분" 형식으로 변환
 * @param hours Float (예: 8.5)
 * @returns "8시간 30분" 또는 "8시간" (분이 0인 경우)
 */
export function formatHoursToDisplay(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

/**
 * [C-002] yearMonth 기준 월 시작/종료 UTC DateTime 반환 (Prisma where 조건용)
 * - KST 기준 월 시작일 00:00:00 과 다음 달 1일 00:00:00 을 UTC로 변환
 * - @db.Date 필드(WorkRecord.date) 범위 조회에 사용
 * @param yearMonth "YYYY-MM" 형식
 * @returns { gte: Date, lt: Date } UTC 기준 월 범위
 */
export function getMonthRangeUTC(yearMonth: string): { gte: Date; lt: Date } {
  // KST 기준 월 시작일 00:00:00 → UTC 변환
  const kstStart = `${yearMonth}-01T00:00:00`
  const gte = fromZonedTime(kstStart, TIMEZONE)

  // 다음 달 계산 — Date 객체 조작 후 포맷
  const [year, month] = yearMonth.split('-').map(Number)
  const nextDate = new Date(Date.UTC(year, month, 1)) // month는 0-indexed이므로 month = 현재월+1
  const nextYearMonth = nextDate.toISOString().slice(0, 7)

  // KST 기준 다음 달 1일 00:00:00 → UTC 변환 (lt 조건)
  const kstEnd = `${nextYearMonth}-01T00:00:00`
  const lt = fromZonedTime(kstEnd, TIMEZONE)

  return { gte, lt }
}
