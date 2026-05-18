// src/components/calendar/Calendar.tsx
// 목적: 월간 달력 메인 컴포넌트 — 월 네비게이션, 7열 날짜 그리드, 오늘 자동 포커스
'use client'

import { useState, useMemo } from 'react'
import { WorkRecordDTO, HolidayDTO } from '@/types'
import CalendarDay from './CalendarDay'
import CalendarLegend from './CalendarLegend'

interface CalendarProps {
  records: WorkRecordDTO[]        // 현재 월 업무 기록 목록
  holidays: HolidayDTO[]          // 공휴일 목록
  onDateClick: (date: string) => void  // 날짜 클릭 핸들러
  selectedDate?: string           // 선택된 날짜 (YYYY-MM-DD)
  onMonthChange?: (yearMonth: string) => void  // 월 변경 시 부모에 알림
}

// 요일 헤더 레이블 — 일요일부터 시작
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// KST 기준 오늘 날짜 반환 (클라이언트 환경 — 브라우저 로컬 타임)
function getTodayStr(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// YYYY-MM 형식에서 년, 월 추출
function parseYearMonth(yearMonthStr: string): { year: number; month: number } {
  const [y, m] = yearMonthStr.split('-').map(Number)
  return { year: y, month: m }
}

// 특정 년/월의 YYYY-MM 문자열 생성
function toYearMonthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

// 특정 날짜의 YYYY-MM-DD 문자열 생성
function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 월간 달력 메인 컴포넌트
 * - 이전/다음 월 네비게이션 버튼
 * - 7열 날짜 그리드 (일요일 시작)
 * - 각 날짜는 CalendarDay 컴포넌트로 렌더링
 * - onMonthChange: 월 변경 시 부모에서 새 데이터 fetch 가능
 */
export default function Calendar({
  records,
  holidays,
  onDateClick,
  selectedDate,
  onMonthChange,
}: CalendarProps) {
  const today = getTodayStr()

  // 현재 표시 중인 연/월 (기본값: 오늘 달)
  const [currentYearMonth, setCurrentYearMonth] = useState<string>(() => {
    return today.slice(0, 7)  // "YYYY-MM"
  })

  const { year, month } = parseYearMonth(currentYearMonth)

  // 업무 기록을 날짜(YYYY-MM-DD) → WorkRecordDTO Map으로 변환 (O(1) 조회)
  const recordMap = useMemo(() => {
    const map = new Map<string, WorkRecordDTO>()
    records.forEach((r) => {
      // r.date는 ISO 8601 문자열이므로 앞 10자리만 사용
      const dateKey = r.date.slice(0, 10)
      map.set(dateKey, r)
    })
    return map
  }, [records])

  // 공휴일을 날짜 → HolidayDTO Map으로 변환
  const holidayMap = useMemo(() => {
    const map = new Map<string, HolidayDTO>()
    holidays.forEach((h) => {
      map.set(h.date.slice(0, 10), h)
    })
    return map
  }, [holidays])

  // 현재 월의 달력 셀 배열 생성 (이전/다음 월 패딩 포함)
  const calendarCells = useMemo(() => {
    // 현재 월의 1일
    const firstDay = new Date(year, month - 1, 1)
    // 현재 월의 마지막 날짜
    const lastDay = new Date(year, month, 0).getDate()
    // 1일의 요일 (0=일, 1=월, ..., 6=토)
    const startWeekday = firstDay.getDay()

    const cells: Array<{ date: string; isCurrentMonth: boolean }> = []

    // 이전 월 패딩 — 1일 이전 빈 칸을 이전 달 날짜로 채움
    if (startWeekday > 0) {
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate()
      const prevYear = month === 1 ? year - 1 : year
      const prevMonth = month === 1 ? 12 : month - 1
      for (let d = startWeekday - 1; d >= 0; d--) {
        cells.push({
          date: toDateStr(prevYear, prevMonth, prevMonthLastDay - d),
          isCurrentMonth: false,
        })
      }
    }

    // 현재 월 날짜
    for (let d = 1; d <= lastDay; d++) {
      cells.push({
        date: toDateStr(year, month, d),
        isCurrentMonth: true,
      })
    }

    // 다음 월 패딩 — 마지막 주를 7의 배수로 채움
    const remaining = cells.length % 7
    if (remaining > 0) {
      const nextYear = month === 12 ? year + 1 : year
      const nextMonth = month === 12 ? 1 : month + 1
      for (let d = 1; d <= 7 - remaining; d++) {
        cells.push({
          date: toDateStr(nextYear, nextMonth, d),
          isCurrentMonth: false,
        })
      }
    }

    return cells
  }, [year, month])

  // 이전 월로 이동
  function handlePrevMonth() {
    const newYear = month === 1 ? year - 1 : year
    const newMonth = month === 1 ? 12 : month - 1
    const newYearMonth = toYearMonthStr(newYear, newMonth)
    setCurrentYearMonth(newYearMonth)
    onMonthChange?.(newYearMonth)
  }

  // 다음 월로 이동
  function handleNextMonth() {
    const newYear = month === 12 ? year + 1 : year
    const newMonth = month === 12 ? 1 : month + 1
    const newYearMonth = toYearMonthStr(newYear, newMonth)
    setCurrentYearMonth(newYearMonth)
    onMonthChange?.(newYearMonth)
  }

  // 오늘 날짜 달로 이동
  function handleGoToday() {
    const todayYearMonth = today.slice(0, 7)
    setCurrentYearMonth(todayYearMonth)
    onMonthChange?.(todayYearMonth)
  }

  return (
    <div className="w-full">
      {/* 달력 헤더 — 연/월 표시 + 네비게이션 버튼 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="이전 달"
        >
          ‹
        </button>

        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800">
            {year}년 {month}월
          </h2>
          <button
            onClick={handleGoToday}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            오늘
          </button>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={[
              'text-center text-xs font-semibold py-1',
              idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500',
            ].join(' ')}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarCells.map(({ date, isCurrentMonth }) => {
          const record = recordMap.get(date)
          const holiday = holidayMap.get(date)
          const isToday = date === today
          const isSelected = date === selectedDate
          const isFuture = date > today

          return (
            <CalendarDay
              key={date}
              date={date}
              record={record}
              isHoliday={!!holiday}
              holidayName={holiday?.name}
              isToday={isToday}
              isSelected={isSelected}
              isFuture={isFuture}
              isCurrentMonth={isCurrentMonth}
              onClick={() => onDateClick(date)}
            />
          )
        })}
      </div>

      {/* 범례 */}
      <CalendarLegend />
    </div>
  )
}
