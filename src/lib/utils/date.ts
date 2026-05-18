// src/lib/utils/date.ts
// 목적: 날짜 포맷 및 유효성 검증 유틸 — KST 기준 날짜 처리
// [C-001] formatInTimeZone 기반 — UTC 서버 환경에서도 KST 기준 날짜 보장

import { format, parseISO, addMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { TIMEZONE } from './time'

// 요일 한국어 레이블 배열 — date.getDay() 인덱스 기준 (0=일요일)
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * YYYY-MM-DD 문자열을 "YYYY년 MM월 DD일 (요일)" 형식으로 변환
 * @param dateStr YYYY-MM-DD
 * @returns "2026년 05월 18일 (월)"
 */
export function formatDateKo(dateStr: string): string {
  const date = parseISO(dateStr)
  const day = DAY_LABELS[date.getDay()]
  return `${format(date, 'yyyy년 MM월 dd일')} (${day})`
}

/**
 * Date 객체를 KST 기준 YYYY-MM-DD 형식으로 변환
 * [C-001] formatInTimeZone 사용 — UTC Date를 KST로 올바르게 변환
 * @param date UTC Date 객체
 * @returns "YYYY-MM-DD" 문자열
 */
export function formatDate(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd')
}

/**
 * 요일 한국어 반환 — "월", "화", ...
 * @param dateStr YYYY-MM-DD
 * @returns 요일 한국어 (1글자)
 */
export function getDayOfWeekKo(dateStr: string): string {
  const date = parseISO(dateStr)
  return DAY_LABELS[date.getDay()]
}

/**
 * [C-001] 오늘 날짜를 KST 기준 YYYY-MM-DD 문자열로 반환
 * - UTC 서버 환경에서도 KST 기준 날짜 보장 (formatInTimeZone 사용)
 * - time.ts의 getTodayKST()와 동일 — date.ts에서 직접 접근 가능하도록 재노출
 */
export function getTodayKST(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd')
}

/**
 * YYYY-MM-DD 형식 유효성 검증
 * @param dateStr 검증할 날짜 문자열
 * @returns 유효한 날짜이면 true
 */
export function isValidDateStr(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateStr)) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

/**
 * 해당 날짜가 오늘 이후(미래)인지 확인 (KST 기준)
 * 달력에서 미래 날짜 기록 입력 비활성화에 사용
 * @param dateStr YYYY-MM-DD
 * @returns 미래 날짜이면 true
 */
export function isFutureDate(dateStr: string): boolean {
  const today = getTodayKST()
  return dateStr > today
}

/**
 * [C-002] yearMonth 기준 월 범위 UTC DateTime 반환 (Prisma where 조건용)
 * - KST 기준 월 시작일 00:00:00 과 다음 달 1일 00:00:00 을 UTC로 변환
 * - WorkRecord.date(@db.Date) 범위 조회에 사용
 * @param yearMonth "YYYY-MM" 형식
 * @returns { gte: Date, lt: Date } UTC 기준 월 범위
 */
export function getMonthRangeUTC(yearMonth: string): { gte: Date; lt: Date } {
  const baseDate = parseISO(`${yearMonth}-01`)

  // KST 기준 월 시작일 00:00:00 → UTC 변환
  const kstStart = `${yearMonth}-01T00:00:00`
  const gte = fromZonedTime(kstStart, TIMEZONE)

  // 다음 달 계산 — date-fns addMonths 사용 후 포맷
  const nextMonth = addMonths(baseDate, 1)
  const nextMonthStr = format(nextMonth, 'yyyy-MM')

  // KST 기준 다음 달 1일 00:00:00 → UTC 변환 (lt 조건)
  const kstEnd = `${nextMonthStr}-01T00:00:00`
  const lt = fromZonedTime(kstEnd, TIMEZONE)

  return { gte, lt }
}
