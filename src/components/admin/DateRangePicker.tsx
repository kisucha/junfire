// src/components/admin/DateRangePicker.tsx
// 목적: 관리자 기간 선택 컴포넌트 — 시작일/종료일 날짜 인풋
'use client'

import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

interface DateRangePickerProps {
  startDate: string                               // YYYY-MM-DD
  endDate: string                                 // YYYY-MM-DD
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onSearch: () => void                            // 조회 버튼 클릭 핸들러
  isLoading?: boolean                             // 조회 중 버튼 비활성화
  error?: string                                  // 날짜 범위 에러 메시지
}

/**
 * 기간 선택 컴포넌트
 * - 시작일 ~ 종료일 날짜 인풋
 * - 조회 버튼 클릭 시 onSearch 호출
 */
export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSearch,
  isLoading = false,
  error,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* 시작일 */}
      <div className="w-40">
        <Input
          label="시작일"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* 구분 텍스트 */}
      <span className="pb-2 text-gray-500 text-sm">~</span>

      {/* 종료일 */}
      <div className="w-40">
        <Input
          label="종료일"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* 조회 버튼 */}
      <Button
        variant="primary"
        onClick={onSearch}
        isLoading={isLoading}
        className="mb-0.5"
      >
        조회
      </Button>

      {/* 에러 메시지 */}
      {error && (
        <p className="w-full text-xs text-red-500 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
