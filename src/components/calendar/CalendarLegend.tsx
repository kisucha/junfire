// src/components/calendar/CalendarLegend.tsx
// 목적: 달력 하단 색상 범례 — 모든 상태 색상 표시
'use client'

// 범례 항목 데이터 구조
interface LegendItem {
  color: string   // Tailwind 배경색 클래스
  label: string   // 한국어 설명
}

// 모든 상태별 색상 범례 목록
const legendItems: LegendItem[] = [
  { color: 'bg-green-500',  label: '정상근무' },
  { color: 'bg-red-400',    label: '미기록' },
  { color: 'bg-yellow-400', label: '병가' },
  { color: 'bg-blue-500',   label: '연차' },
  { color: 'bg-gray-400',   label: '무급' },
  { color: 'bg-purple-500', label: '공휴일' },
]

/**
 * 달력 하단 색상 범례 컴포넌트
 * - 모든 업무 상태 + 공휴일 색상을 한 행에 나열
 */
export default function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 mt-3 px-1">
      {legendItems.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          {/* 색상 사각형 */}
          <span
            className={`inline-block w-3 h-3 rounded-sm ${color}`}
            aria-hidden="true"
          />
          {/* 레이블 */}
          <span className="text-xs text-gray-600">{label}</span>
        </div>
      ))}
    </div>
  )
}
