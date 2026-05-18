// src/components/admin/ReportTable.tsx
// 목적: 관리자 보고서 테이블 — 전 직원 기록 cursor 기반 Load More 조회
'use client'

import { useState, useEffect, useRef } from 'react'
import { WorkRecordDTO, RecordStatus, StatusLabel } from '@/types'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'

interface ReportTableProps {
  startDate: string    // YYYY-MM-DD — 조회 시작일
  endDate: string      // YYYY-MM-DD — 조회 종료일
  // 외부에서 조회 트리거 — 이 값이 바뀌면 새 조회 시작
  searchTrigger: number
}

// 상태별 스타일
const statusStyles: Record<RecordStatus, string> = {
  WORK:   'bg-green-100 text-green-700',
  SICK:   'bg-yellow-100 text-yellow-700',
  ANNUAL: 'bg-blue-100 text-blue-700',
  UNPAID: 'bg-gray-100 text-gray-600',
}

/**
 * 전 직원 기록 보고서 테이블
 * - cursor 기반 Load More 페이징
 * - searchTrigger 변경 시 첫 페이지부터 새 조회
 * - 날짜 클릭 → 관리자 대리 입력 페이지 이동
 */
export default function ReportTable({ startDate, endDate, searchTrigger }: ReportTableProps) {
  const { showToast } = useToast()
  const router = useRouter()

  // 기록 목록 상태
  const [records, setRecords] = useState<WorkRecordDTO[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // 현재 활성 날짜 범위 — Load More 시 동일 파라미터 유지
  const activeDatesRef = useRef({ startDate, endDate })

  // searchTrigger 변경 시 첫 페이지 조회 (useEffect로 안전하게 처리)
  useEffect(() => {
    activeDatesRef.current = { startDate, endDate }
    loadRecords(null, true, startDate, endDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTrigger])

  // 기록 로드 함수
  async function loadRecords(
    cursor: string | null,
    isFirst: boolean,
    qStartDate: string,
    qEndDate: string
  ) {
    if (isFirst) setIsLoading(true)
    else setIsLoadingMore(true)

    try {
      const params = new URLSearchParams({
        take: '30',
        startDate: qStartDate,
        endDate: qEndDate,
      })
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/admin/records?${params}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '조회에 실패했습니다.', 'error')
        return
      }

      if (isFirst) {
        setRecords(json.data)
      } else {
        setRecords((prev) => [...prev, ...json.data])
      }
      setNextCursor(json.nextCursor)
      setHasMore(json.hasMore)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      if (isFirst) setIsLoading(false)
      else setIsLoadingMore(false)
    }
  }

  // 대리 입력 페이지로 이동
  function handleRecordClick(userId: string, date: string) {
    const dateStr = date.slice(0, 10)
    router.push(`/admin/records/${userId}/${dateStr}`)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (records.length === 0 && !isLoading) {
    return (
      <p className="text-center text-gray-400 py-8">
        조회 기간에 해당하는 기록이 없습니다.
      </p>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">직원</th>
              <th className="px-4 py-3 text-left font-medium">날짜</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
              <th className="px-4 py-3 text-left font-medium">장소</th>
              <th className="px-4 py-3 text-left font-medium">시작</th>
              <th className="px-4 py-3 text-left font-medium">종료</th>
              <th className="px-4 py-3 text-left font-medium">총 시간</th>
              <th className="px-4 py-3 text-left font-medium">대리 입력</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map((record) => {
              const dateStr = record.date.slice(0, 10)
              const startTimeStr = record.startTime
                ? new Date(record.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                : '-'
              const endTimeStr = record.endTime
                ? new Date(record.endTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                : '-'

              return (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {record.user?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{dateStr}</td>
                  <td className="px-4 py-3">
                    <span className={[
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      statusStyles[record.status],
                    ].join(' ')}>
                      {StatusLabel[record.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{record.location ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{startTimeStr}</td>
                  <td className="px-4 py-3 text-gray-600">{endTimeStr}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {record.totalHours != null ? `${record.totalHours}시간` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRecordClick(record.userId, record.date)}
                    >
                      수정
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Load More 버튼 */}
      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button
            variant="secondary"
            onClick={() => loadRecords(nextCursor, false, activeDatesRef.current.startDate, activeDatesRef.current.endDate)}
            isLoading={isLoadingMore}
          >
            더 보기
          </Button>
        </div>
      )}
    </div>
  )
}
