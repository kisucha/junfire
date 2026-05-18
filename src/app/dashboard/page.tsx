// src/app/dashboard/page.tsx
// 목적: 직원 대시보드 — 월간 달력 뷰, 업무 기록 현황 표시
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { WorkRecordDTO, HolidayDTO } from '@/types'
import Calendar from '@/components/calendar/Calendar'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

/**
 * 직원 대시보드 페이지
 * - 현재 월 WorkRecord 목록 fetch (/api/records?yearMonth=YYYY-MM)
 * - Holiday 목록 fetch (/api/holidays?year=&month=)
 * - Calendar 컴포넌트로 월간 달력 렌더링
 * - 날짜 클릭 → /dashboard/record/:date 이동
 * - 오늘 날짜 자동 선택
 */
export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { showToast } = useToast()

  // 오늘 날짜 (클라이언트 로컬 타임 기준)
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const currentYearMonth = todayStr.slice(0, 7)

  // 현재 조회 중인 연/월
  const [yearMonth, setYearMonth] = useState(currentYearMonth)

  // 선택된 날짜 — 오늘 날짜로 초기화
  const [selectedDate, setSelectedDate] = useState(todayStr)

  // 업무 기록 목록
  const [records, setRecords] = useState<WorkRecordDTO[]>([])
  // 공휴일 목록
  const [holidays, setHolidays] = useState<HolidayDTO[]>([])
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(true)

  // 업무 기록 + 공휴일 동시 fetch
  const fetchData = useCallback(async (ym: string) => {
    setIsLoading(true)
    const [year, month] = ym.split('-')

    try {
      const [recordsRes, holidaysRes] = await Promise.all([
        fetch(`/api/records?yearMonth=${ym}&take=31`),
        fetch(`/api/holidays?year=${year}&month=${month}`),
      ])

      const recordsJson = await recordsRes.json()
      const holidaysJson = await holidaysRes.json()

      if (!recordsRes.ok || !recordsJson.success) {
        showToast('업무 기록 조회에 실패했습니다.', 'error')
      } else {
        setRecords(recordsJson.data ?? [])
      }

      if (!holidaysRes.ok || !holidaysJson.success) {
        // 공휴일 조회 실패는 달력 기능에 치명적이지 않으므로 경고만
        setHolidays([])
      } else {
        setHolidays(holidaysJson.data ?? [])
      }
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  // 초기 로드 및 yearMonth 변경 시 데이터 새로고침
  useEffect(() => {
    fetchData(yearMonth)
  }, [yearMonth, fetchData])

  // 날짜 클릭 핸들러 — 기록 입력/수정 페이지로 이동
  function handleDateClick(date: string) {
    setSelectedDate(date)
    router.push(`/dashboard/record/${date}`)
  }

  // 월 변경 핸들러 — Calendar에서 호출
  function handleMonthChange(newYearMonth: string) {
    setYearMonth(newYearMonth)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 네비게이션 바 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🔥</span>
            <span className="font-bold text-gray-800">JunFire Protection</span>
          </div>

          {/* 사용자 정보 + 로그아웃 */}
          <div className="flex items-center gap-3">
            {session && (
              <span className="text-sm text-gray-600">
                {session.user.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 페이지 제목 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">업무 기록</h1>
          <p className="text-sm text-gray-500 mt-1">
            날짜를 클릭하여 업무 기록을 입력하거나 수정하세요.
          </p>
        </div>

        {/* 달력 카드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <Calendar
              records={records}
              holidays={holidays}
              onDateClick={handleDateClick}
              selectedDate={selectedDate}
              onMonthChange={handleMonthChange}
            />
          )}
        </div>
      </main>
    </div>
  )
}
