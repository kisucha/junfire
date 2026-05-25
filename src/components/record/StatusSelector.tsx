// src/components/record/StatusSelector.tsx
// 목적: 업무 상태 선택 라디오 버튼 컴포넌트 — WORK/SICK/ANNUAL/UNPAID 선택
'use client'

import { RecordStatus, StatusLabel } from '@/types'

interface StatusSelectorProps {
  value: RecordStatus             // 현재 선택된 상태
  onChange: (status: RecordStatus) => void  // 상태 변경 핸들러
  disabled?: boolean              // 비활성화 여부
  hideHoliday?: boolean           // true면 HOLIDAY 옵션 숨김 (직원용)
}

// 상태별 선택 시 강조 스타일
const statusActiveStyles: Record<RecordStatus, string> = {
  WORK:    'bg-green-100 border-green-500 text-green-800',
  SICK:    'bg-red-100 border-red-500 text-red-800',
  ANNUAL:  'bg-blue-100 border-blue-500 text-blue-800',
  UNPAID:  'bg-gray-100 border-gray-500 text-gray-800',
  HOLIDAY: 'bg-yellow-100 border-yellow-500 text-yellow-800',
}

// 선택되지 않은 상태 기본 스타일
const statusInactiveStyle = 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'

// 상태 선택 순서 정의
const STATUS_ORDER: RecordStatus[] = ['WORK', 'SICK', 'ANNUAL', 'UNPAID', 'HOLIDAY']

/**
 * 업무 상태 선택 컴포넌트
 * - 상태를 버튼 형태의 라디오 그룹으로 표시
 * - 선택된 상태는 색상 강조
 * - hideHoliday=true 시 HOLIDAY 옵션 숨김 (직원용)
 */
export default function StatusSelector({ value, onChange, disabled = false, hideHoliday = false }: StatusSelectorProps) {
  // hideHoliday가 true이면 HOLIDAY 제외
  const visibleStatuses = hideHoliday
    ? STATUS_ORDER.filter((s) => s !== 'HOLIDAY')
    : STATUS_ORDER

  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700 mb-2">업무 상태</legend>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visibleStatuses.map((status) => {
          const isSelected = value === status

          return (
            <label
              key={status}
              className={[
                'flex items-center justify-center gap-1.5 px-3 py-2.5',
                'border-2 rounded-lg cursor-pointer transition-all duration-100',
                'text-sm font-medium select-none',
                disabled ? 'opacity-50 cursor-not-allowed' : '',
                isSelected ? statusActiveStyles[status] : statusInactiveStyle,
              ].join(' ')}
            >
              {/* 라디오 인풋 — 시각적으로 숨김 (레이블이 클릭 영역) */}
              <input
                type="radio"
                name="status"
                value={status}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onChange(status)}
                className="sr-only"
              />
              {/* 상태 한국어 레이블 */}
              <span>{StatusLabel[status]}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
