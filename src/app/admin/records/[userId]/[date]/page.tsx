// src/app/admin/records/[userId]/[date]/page.tsx
// 목적: 관리자 대리 입력 페이지 — 특정 직원의 특정 날짜 기록 입력/수정
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { WorkRecordDTO, UserDTO } from '@/types'
import RecordForm from '@/components/record/RecordForm'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

/**
 * 관리자 대리 입력 페이지
 * - URL params: userId, date (YYYY-MM-DD)
 * - 대상 직원 정보 표시
 * - RecordForm: /api/admin/records/override API 호출
 */
export default function AdminRecordOverridePage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()

  // URL 파라미터에서 userId, date 추출
  const userId = typeof params.userId === 'string' ? params.userId : ''
  const date = typeof params.date === 'string' ? params.date : ''

  // 대상 직원 정보
  const [targetUser, setTargetUser] = useState<UserDTO | null>(null)
  // 해당 날짜 기존 기록
  const [existingRecord, setExistingRecord] = useState<WorkRecordDTO | undefined>(undefined)
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(true)

  // 날짜 형식 유효성 검증
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date)

  // 대상 직원 정보 + 기존 기록 동시 로드
  useEffect(() => {
    if (!userId || !isValidDate) {
      setIsLoading(false)
      return
    }

    async function fetchData() {
      setIsLoading(true)
      try {
        // 직원 정보 + 해당 날짜 기록 동시 조회
        const yearMonth = date.slice(0, 7)

        const [userRes, recordsRes] = await Promise.all([
          fetch(`/api/admin/staff/${userId}`),
          fetch(`/api/admin/records?userId=${userId}&startDate=${date}&endDate=${date}&take=5`),
        ])

        // 직원 정보 처리
        if (userRes.ok) {
          const userJson = await userRes.json()
          if (userJson.success) setTargetUser(userJson.data)
        }

        // 기록 처리 — 해당 날짜 기록 찾기
        if (recordsRes.ok) {
          const recordsJson = await recordsRes.json()
          if (recordsJson.success && recordsJson.data?.length > 0) {
            const found = (recordsJson.data as WorkRecordDTO[]).find(
              (r) => r.date.slice(0, 10) === date
            )
            setExistingRecord(found)
          }
        }
      } catch {
        showToast('데이터 조회에 실패했습니다.', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [userId, date, isValidDate, showToast])

  // 저장 성공 후 이전 페이지 (관리자 대시보드)로 이동
  function handleSuccess() {
    router.back()
  }

  // 잘못된 파라미터 처리
  if (!userId || !isValidDate) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-500">잘못된 접근입니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-lg">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          aria-label="이전 페이지로 돌아가기"
        >
          ← 뒤로
        </Button>
        <h1 className="text-lg font-bold text-gray-800">관리자 대리 입력</h1>
      </div>

      {/* 대상 직원 + 날짜 정보 */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
        <p className="text-sm text-orange-800">
          <span className="font-medium">
            {targetUser ? targetUser.name : userId}
          </span>
          {' 직원의 '}
          <span className="font-medium">{date}</span>
          {' 기록을 관리자 권한으로 입력/수정합니다.'}
        </p>
      </div>

      {/* 기록 폼 카드 */}
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
            // 관리자 대리 입력: override API 경로 사용
            apiBasePath="/api/admin/records/override"
            targetUserId={userId}
          />
        )}
      </div>
    </div>
  )
}
