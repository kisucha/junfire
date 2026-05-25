// src/app/dashboard/record/[date]/page.tsx
// 목적: 날짜별 업무 기록 입력/수정/삭제 페이지
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { WorkRecordDTO } from '@/types'
import RecordForm from '@/components/record/RecordForm'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

/**
 * 날짜별 업무 기록 입력/수정 페이지
 * - URL params에서 date (YYYY-MM-DD) 추출
 * - /api/records?yearMonth=... 에서 해당 날짜 기록 찾기
 * - RecordForm 컴포넌트로 입력/수정/삭제 처리
 * - 뒤로가기 버튼 → /dashboard
 */
export default function RecordPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()

  // URL 파라미터에서 날짜 추출
  const date = typeof params.date === 'string' ? params.date : ''

  // 해당 날짜 기존 기록
  const [existingRecord, setExistingRecord] = useState<WorkRecordDTO | undefined>(undefined)
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(true)

  // 날짜 형식 유효성 검증
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date)

  // 해당 날짜 기록 조회
  useEffect(() => {
    if (!isValidDate) {
      setIsLoading(false)
      return
    }

    async function fetchRecord() {
      setIsLoading(true)
      try {
        // yearMonth 기준으로 해당 월 전체 조회 후 날짜 필터링
        const yearMonth = date.slice(0, 7)
        const res = await fetch(`/api/records?yearMonth=${yearMonth}&take=31`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          showToast('기록 조회에 실패했습니다.', 'error')
          return
        }

        // 해당 날짜 기록 찾기
        const found = (json.data as WorkRecordDTO[]).find(
          (r) => r.date.slice(0, 10) === date
        )
        setExistingRecord(found)
      } catch {
        showToast('네트워크 오류가 발생했습니다.', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecord()
  }, [date, isValidDate, showToast])

  // 저장/수정/삭제 성공 콜백 — 업무 기록 달력으로 이동
  function handleSuccess() {
    router.push('/dashboard/work')
  }

  // 잘못된 날짜 형식
  if (!isValidDate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">잘못된 날짜입니다.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          {/* 뒤로가기 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/work')}
            aria-label="달력으로 돌아가기"
          >
            ← 달력
          </Button>

          <span className="font-semibold text-gray-800">{date} 업무 기록</span>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <RecordForm
              date={date}
              existingRecord={existingRecord}
              onSuccess={handleSuccess}
              apiBasePath="/api/records"
            />
          )}
        </div>
      </main>
    </div>
  )
}
