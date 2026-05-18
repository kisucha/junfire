// src/app/admin/page.tsx
// 목적: 관리자 대시보드 — 기간 조회 + 전 직원 기록 테이블
'use client'

import { useState } from 'react'
import DateRangePicker from '@/components/admin/DateRangePicker'
import ReportTable from '@/components/admin/ReportTable'
import SummaryTable from '@/components/admin/SummaryTable'
import LocationManager from '@/components/admin/LocationManager'

// 현재 주의 월요일 ~ 일요일 날짜 반환
function getCurrentWeekRange(): { startDate: string; endDate: string } {
  const today = new Date()
  const dayOfWeek = today.getDay()  // 0=일요일

  // 월요일 = 오늘 - (dayOfWeek - 1), 일요일은 -6 처리
  const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1)
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return { startDate: fmt(monday), endDate: fmt(sunday) }
}

/**
 * 관리자 대시보드 페이지
 * - DateRangePicker로 기간 선택 (기본: 현재 주)
 * - ReportTable로 전 직원 기록 표시
 * - 조회 버튼 클릭 시 searchTrigger 증가 → ReportTable 재조회
 */
export default function AdminDashboardPage() {
  const { startDate: defaultStart, endDate: defaultEnd } = getCurrentWeekRange()

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [dateError, setDateError] = useState('')
  const [searchTrigger, setSearchTrigger] = useState(0)
  const [includeInactive, setIncludeInactive] = useState(false)

  // 조회 버튼 클릭 — 날짜 유효성 검증 후 검색 트리거
  function handleSearch() {
    if (!startDate || !endDate) {
      setDateError('시작일과 종료일을 모두 선택해주세요.')
      return
    }
    if (startDate > endDate) {
      setDateError('시작일은 종료일보다 이전이어야 합니다.')
      return
    }
    setDateError('')
    setSearchTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">관리자 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">기간별 전 직원 업무 기록을 조회합니다.</p>
      </div>

      {/* 기간 선택 카드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">기간 선택</h2>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(d) => {
            setStartDate(d)
            if (dateError) setDateError('')
          }}
          onEndDateChange={(d) => {
            setEndDate(d)
            if (dateError) setDateError('')
          }}
          onSearch={handleSearch}
          error={dateError}
        />
        <div className="flex items-center gap-2 mt-3">
          <input
            type="checkbox"
            id="includeInactive"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="includeInactive" className="text-sm text-gray-600">
            비활성화된 직원도 포함
          </label>
        </div>
      </div>

      {/* 직원별 집계 테이블 */}
      {searchTrigger > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            직원별 집계 ({startDate} ~ {endDate})
          </h2>
          <SummaryTable
            startDate={startDate}
            endDate={endDate}
            includeInactive={includeInactive}
            searchTrigger={searchTrigger}
          />
        </div>
      )}

      {/* 상세 기록 테이블 */}
      {searchTrigger > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            상세 기록 ({startDate} ~ {endDate})
          </h2>
          <ReportTable
            startDate={startDate}
            endDate={endDate}
            searchTrigger={searchTrigger}
          />
        </div>
      )}

      {/* 안내 메시지 — 첫 방문 시 */}
      {searchTrigger === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">기간을 선택하고 조회 버튼을 클릭하세요.</p>
        </div>
      )}

      {/* 업무 현장 관리 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <LocationManager />
      </div>
    </div>
  )
}
