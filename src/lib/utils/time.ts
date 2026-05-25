// src/lib/utils/time.ts
// 목적: 시간 계산 유틸 — NZT(뉴질랜드 표준시) 기준 입력값으로 UTC 저장
// [C-001 CRITICAL] setHours/setMinutes 등 로컬 타임존 의존 메서드 사용 금지
// 운영 서버(UTC 환경)에서 setHours 사용 시 오차 발생 — ISO 문자열 직접 사용

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

// NZT(뉴질랜드 표준시) 타임존 상수 — 이 파일 전체에서 반드시 이 상수만 사용 (직접 문자열 금지)
export const TIMEZONE = 'Pacific/Auckland'

/**
 * 오늘 날짜를 NZT 기준 YYYY-MM-DD 문자열로 반환
 * [C-001] formatInTimeZone 사용 — UTC 서버 환경에서도 NZT 기준 오늘 날짜 보장
 */
export function getTodayKST(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd')
}

/**
 * [C-001] HH:mm 문자열을 UTC DateTime으로 변환 (DB 저장용)
 * - NZT 기준 입력된 HH:mm을 UTC로 변환하여 저장
 * - 야간 근무 종료 시각: isNightShiftEnd=true 전달 시 날짜 +1일 처리
 * @param dateStr YYYY-MM-DD 날짜 (NZT 기준)
 * @param timeStr HH:mm (NZT 기준)
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
 * - NZT 기준 입력값을 UTC로 변환하여 시간 계산
 * - 야간 근무 자동 감지: endTime < startTime이면 다음날로 처리
 * - [NF-V2-004] startTime === endTime이면 0 반환 (24시간 기록 방지)
 * @param dateStr YYYY-MM-DD (근무 시작일, NZT 기준)
 * @param startTimeStr HH:mm (NZT 기준)
 * @param endTimeStr HH:mm (NZT 기준)
 * @returns totalHours (Float, 소수점 2자리) — 0 반환 시 API 레이어에서 거부
 */
export function calcTotalHours(
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string
): number {
  // NZT 기준 입력값을 UTC로 변환
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
  return Math.round(diffMs / (1000 * 60 * 60) * 100) / 100
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

// getMonthRangeUTC는 date.ts에 정의됨 — date.ts에서 import하여 사용
