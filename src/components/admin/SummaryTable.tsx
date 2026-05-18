// src/components/admin/SummaryTable.tsx
// 목적: 직원별 기간 집계 테이블 — 상태별 일수 + 총 근무시간
'use client'

import { useState, useEffect } from 'react'
import { EmployeeSummaryDTO } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

interface SummaryTableProps {
  startDate: string
  endDate: string
  includeInactive: boolean
  searchTrigger: number
}

export default function SummaryTable({
  startDate,
  endDate,
  includeInactive,
  searchTrigger,
}: SummaryTableProps) {
  const { showToast } = useToast()
  const [data, setData] = useState<EmployeeSummaryDTO[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (searchTrigger === 0) return
    fetchSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTrigger])

  async function fetchSummary() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate, includeInactive: String(includeInactive) })
      const res = await fetch(`/api/admin/summary?${params}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        showToast(json.error ?? '집계 조회에 실패했습니다.', 'error')
        return
      }
      setData(json.data)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <p className="text-center text-gray-400 py-6 text-sm">
        조회 기간에 해당하는 직원 기록이 없습니다.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-4 py-3 text-left font-medium">직원</th>
            <th className="px-4 py-3 text-center font-medium">정상근무</th>
            <th className="px-4 py-3 text-center font-medium">병가</th>
            <th className="px-4 py-3 text-center font-medium">연차</th>
            <th className="px-4 py-3 text-center font-medium">공휴일</th>
            <th className="px-4 py-3 text-center font-medium">무급</th>
            <th className="px-4 py-3 text-center font-medium">정상근무 실시간</th>
            <th className="px-4 py-3 text-center font-medium bg-blue-50 text-blue-700">총 근무시간</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row) => (
            <tr key={row.userId} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
              <td className="px-4 py-3 text-center text-gray-600">
                {row.workDays > 0 ? `${row.workDays}일` : '-'}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {row.sickDays > 0 ? `${row.sickDays}일` : '-'}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {row.annualDays > 0 ? `${row.annualDays}일` : '-'}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {row.holidayDays > 0 ? `${row.holidayDays}일` : '-'}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {row.unpaidDays > 0 ? `${row.unpaidDays}일` : '-'}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {row.workActualHours > 0 ? `${row.workActualHours}시간` : '-'}
              </td>
              <td className="px-4 py-3 text-center font-semibold text-blue-700 bg-blue-50">
                {row.totalHours}시간
              </td>
            </tr>
          ))}
        </tbody>
        {/* 합계 행 */}
        {data.length > 1 && (
          <tfoot className="bg-gray-100 font-semibold text-gray-700">
            <tr>
              <td className="px-4 py-3">합계</td>
              <td className="px-4 py-3 text-center">{data.reduce((s, r) => s + r.workDays, 0)}일</td>
              <td className="px-4 py-3 text-center">{data.reduce((s, r) => s + r.sickDays, 0)}일</td>
              <td className="px-4 py-3 text-center">{data.reduce((s, r) => s + r.annualDays, 0)}일</td>
              <td className="px-4 py-3 text-center">{data.reduce((s, r) => s + r.holidayDays, 0)}일</td>
              <td className="px-4 py-3 text-center">{data.reduce((s, r) => s + r.unpaidDays, 0)}일</td>
              <td className="px-4 py-3 text-center">{data.reduce((s, r) => s + r.workActualHours, 0)}시간</td>
              <td className="px-4 py-3 text-center text-blue-700 bg-blue-50">
                {data.reduce((s, r) => s + r.totalHours, 0)}시간
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
