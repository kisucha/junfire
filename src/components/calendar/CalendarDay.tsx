// src/components/calendar/CalendarDay.tsx
// 목적: 달력 날짜 셀 컴포넌트 — 업무 상태별 배경색 및 오늘 강조 처리
'use client'

import { WorkRecordDTO, RecordStatus } from '@/types'

interface CalendarDayProps {
  date: string                // YYYY-MM-DD
  record?: WorkRecordDTO      // 해당 날짜 업무 기록 (없으면 undefined)
  isHoliday?: boolean         // 공휴일 여부
  holidayName?: string        // 공휴일 이름
  isToday: boolean            // 오늘 날짜 여부
  isSelected: boolean         // 현재 선택된 날짜 여부
  isFuture: boolean           // 미래 날짜 여부
  isCurrentMonth: boolean     // 현재 월 날짜 여부 (이전/다음 월 셀은 흐리게)
  onClick: () => void         // 날짜 클릭 핸들러
}

// 업무 상태별 배경색 — RESEARCH.md 색상 기준
const statusBgMap: Record<RecordStatus, string> = {
  WORK:    'bg-green-500 text-white',
  SICK:    'bg-red-400 text-white',
  ANNUAL:  'bg-blue-500 text-white',
  UNPAID:  'bg-gray-400 text-white',
  HOLIDAY: 'bg-yellow-400 text-white',
}

// 업무 상태별 한국어 레이블
const statusLabelMap: Record<RecordStatus, string> = {
  WORK:    '근무',
  SICK:    '병가',
  ANNUAL:  '연차',
  UNPAID:  '무급',
  HOLIDAY: '공휴일',
}

/**
 * 달력 날짜 셀 컴포넌트
 * 상태별 배경색:
 *   - WORK(정상근무): bg-green-500
 *   - 과거 + 미기록: bg-red-400 (빠진 날)
 *   - SICK(병가): bg-yellow-400
 *   - ANNUAL(연차): bg-blue-500
 *   - UNPAID(무급): bg-gray-400
 *   - 공휴일: bg-purple-500
 *   - 오늘: ring-2 ring-blue-600 강조
 *   - 미래: 기본 흰색
 */
export default function CalendarDay({
  date,
  record,
  isHoliday = false,
  holidayName,
  isToday,
  isSelected,
  isFuture,
  isCurrentMonth,
  onClick,
}: CalendarDayProps) {
  // 날짜에서 일(day) 숫자만 추출 (YYYY-MM-DD → DD)
  const dayNumber = parseInt(date.split('-')[2], 10)

  // 셀 배경색 결정 로직
  let cellBg = 'bg-white hover:bg-gray-50'

  if (isHoliday && !record) {
    // 공휴일이면서 기록 없음 → 보라색
    cellBg = 'bg-purple-500 text-white'
  } else if (record) {
    // 기록이 있으면 상태에 따른 색상
    cellBg = statusBgMap[record.status]
  } else if (!isFuture && isCurrentMonth) {
    // 현재 월 + 과거 + 미기록 → 빨간색 (빠진 날)
    cellBg = 'bg-red-400 text-white'
  }

  // 이전/다음 월 날짜는 흐리게
  const monthOpacity = isCurrentMonth ? '' : 'opacity-30'

  // 오늘 날짜 강조 링
  const todayRing = isToday ? 'ring-2 ring-blue-600 ring-offset-1' : ''

  // 선택된 날짜 강조
  const selectedStyle = isSelected ? 'ring-2 ring-orange-500 ring-offset-1' : ''

  // 미래 날짜 클릭 불가
  const cursorStyle = isFuture ? 'cursor-default' : 'cursor-pointer'

  return (
    <button
      onClick={!isFuture ? onClick : undefined}
      disabled={isFuture}
      aria-label={`${date}${isHoliday && holidayName ? ` (${holidayName})` : ''}${record ? ` - ${statusLabelMap[record.status]}` : ''}`}
      className={[
        'relative flex flex-col items-center justify-start',
        'w-full min-h-[60px] p-1 rounded-md text-xs',
        'transition-all duration-100 focus:outline-none',
        cellBg,
        monthOpacity,
        todayRing,
        selectedStyle,
        cursorStyle,
        // 오늘/선택 이중 링 충돌 방지: isToday가 우선
        isToday && isSelected ? 'ring-blue-600' : '',
      ].join(' ')}
    >
      {/* 날짜 숫자 */}
      <span className="font-semibold text-sm leading-none mt-1">
        {dayNumber}
      </span>

      {/* 공휴일 이름 (있는 경우) */}
      {isHoliday && holidayName && (
        <span className="text-[9px] leading-tight mt-0.5 text-center truncate w-full px-0.5">
          {holidayName}
        </span>
      )}

      {/* 업무 상태 레이블 */}
      {record && (
        <span className="text-[9px] leading-tight mt-0.5">
          {statusLabelMap[record.status]}
        </span>
      )}
    </button>
  )
}
