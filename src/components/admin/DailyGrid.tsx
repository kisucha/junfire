// src/components/admin/DailyGrid.tsx
// 목적: 날짜별 직원 근무시간 크로스 테이블 — 관리자 보고서 상세 섹션

'use client'

import { useState, useEffect } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

/**
 * 날짜별 직원 근무시간 데이터 타입
 */
interface DailyRecord {
  hours: number
  status: string
}

interface DayData {
  date: string
  dayOfWeek: number
  isHoliday: boolean
  holidayName: string | null
  records: Record<string, DailyRecord>
}

interface DailyGridData {
  employees: Array<{ id: string; name: string }>
  days: DayData[]
}

interface DailyGridProps {
  startDate: string
  endDate: string
  includeInactive: boolean
  searchTrigger: number
}

/**
 * 날짜×직원 크로스 테이블 컴포넌트
 * - 각 행: 날짜
 * - 각 열: 직원별 근무시간
 * - 특이 상태 및 요일/공휴일 표시
 * - 합계 행: 직원별 총 근무시간
 */
export default function DailyGrid({
  startDate,
  endDate,
  includeInactive,
  searchTrigger,
}: DailyGridProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DailyGridData | null>(null)

  // searchTrigger 변경 시 API 호출
  useEffect(() => {
    if (searchTrigger === 0) return

    const fetchDailyData = async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/admin/report/daily?startDate=${startDate}&endDate=${endDate}&includeInactive=${includeInactive}`
        )

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          showToast(
            (json as { error?: string }).error ?? '데이터 조회에 실패했습니다.',
            'error'
          )
          return
        }

        const result = await res.json()
        setData(result.data)
      } catch {
        showToast('네트워크 오류가 발생했습니다.', 'error')
      } finally {
        setLoading(false)
      }
    }

    fetchDailyData()
  }, [startDate, endDate, includeInactive, searchTrigger, showToast])

  // 로딩 상태
  if (loading) {
    return <LoadingSpinner />
  }

  // 데이터 없음
  if (!data || data.days.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-gray-500">조회 기간에 해당하는 기록이 없습니다.</p>
      </div>
    )
  }

  // 직원별 합계 시간 계산
  const employeeTotalHours: Record<string, number> = {}
  data.employees.forEach((emp) => {
    employeeTotalHours[emp.id] = 0
  })

  data.days.forEach((day) => {
    Object.entries(day.records).forEach(([userId, record]) => {
      employeeTotalHours[userId] += record.hours
    })
  })

  /**
   * 비고 생성 로직
   * - 공휴일명 > 토/일 > 특이상태직원
   */
  function generateRemark(day: DayData): string {
    const remarks: string[] = []

    // 1. 공휴일 우선
    if (day.isHoliday && day.holidayName) {
      return day.holidayName
    }

    // 2. 요일 (공휴일이 아닐 때만)
    if (day.dayOfWeek === 6) {
      remarks.push('토요일')
    } else if (day.dayOfWeek === 0) {
      remarks.push('일요일')
    }

    // 3. 특이 상태 직원
    const specialStatuses = data!.employees
      .filter((emp) => {
        const record = day.records[emp.id]
        return record && ['SICK', 'ANNUAL', 'UNPAID'].includes(record.status)
      })
      .map((emp) => {
        const record = day.records[emp.id]
        const statusLabel =
          record.status === 'SICK'
            ? '병가'
            : record.status === 'ANNUAL'
              ? '연차'
              : '무급'
        return `${emp.name} ${statusLabel}`
      })

    if (specialStatuses.length > 0) {
      remarks.push(...specialStatuses)
    }

    return remarks.join(', ')
  }

  /**
   * 행 스타일 결정 로직
   */
  function getRowStyle(day: DayData, isLast: boolean): string {
    if (isLast) {
      return 'bg-gray-100'
    }

    if (day.isHoliday) {
      return 'bg-yellow-50'
    }

    if (day.dayOfWeek === 6) {
      return 'bg-blue-50'
    }

    if (day.dayOfWeek === 0) {
      return 'bg-red-50'
    }

    // 홀수/짝수 교대
    const dayIndex = data!.days.indexOf(day)
    return dayIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
  }

  /**
   * 시간 표시 포맷 (정수면 정수, 소수면 1자리)
   */
  function formatHours(hours: number): string {
    if (Number.isInteger(hours)) {
      return hours.toString()
    }
    return hours.toFixed(1)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse border border-gray-200">
        {/* 헤더 */}
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-800 w-24">
              근무일
            </th>
            {data.employees.map((emp) => (
              <th
                key={emp.id}
                className="border border-gray-200 px-4 py-2 text-center font-semibold text-gray-800 min-w-16"
              >
                {emp.name}
              </th>
            ))}
            <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-800 min-w-40">
              비고
            </th>
          </tr>
        </thead>

        {/* 바디 */}
        <tbody>
          {/* 날짜별 행 */}
          {data.days.map((day, dayIndex) => (
            <tr key={day.date} className={getRowStyle(day, false)}>
              {/* 날짜 셀 */}
              <td className="border border-gray-200 px-4 py-2 font-medium text-gray-800">
                {day.date.replace(/-/g, '/')}
              </td>

              {/* 직원별 근무시간 셀 */}
              {data.employees.map((emp) => {
                const record = day.records[emp.id]
                return (
                  <td
                    key={`${day.date}-${emp.id}`}
                    className="border border-gray-200 px-4 py-2 text-center text-gray-700"
                  >
                    {record ? formatHours(record.hours) : '0'}
                  </td>
                )
              })}

              {/* 비고 셀 */}
              <td className="border border-gray-200 px-4 py-2 text-xs text-gray-600">
                {generateRemark(day)}
              </td>
            </tr>
          ))}

          {/* 합계 행 */}
          <tr className={getRowStyle(data.days[0], true)}>
            <td className="border border-gray-200 px-4 py-2 font-semibold text-gray-800">
              총 근무시간
            </td>

            {data.employees.map((emp) => (
              <td
                key={`total-${emp.id}`}
                className="border border-gray-200 px-4 py-2 text-center font-semibold text-gray-800"
              >
                {formatHours(employeeTotalHours[emp.id])}
              </td>
            ))}

            <td className="border border-gray-200 px-4 py-2" />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
