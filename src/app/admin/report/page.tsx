// src/app/admin/report/page.tsx
// 목적: 보고서 페이지 — 기간 선택 + 직원별 집계 미리보기 + PDF 다운로드
'use client'

import { useState } from 'react'
import DateRangePicker from '@/components/admin/DateRangePicker'
import SummaryTable from '@/components/admin/SummaryTable'
import DailyGrid from '@/components/admin/DailyGrid'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

/**
 * 보고서 페이지
 * - 기간 선택 (DateRangePicker) + 조회 버튼 → 직원별 집계 미리보기 표시 [이슈 #2 수정]
 * - 비활성화 직원 포함 여부 체크박스
 * - PDF 다운로드 버튼 → POST /api/admin/report → Blob 다운로드
 */
export default function ReportPage() {
  const { showToast } = useToast()

  // 기본 기간: 이번 달
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const defaultStart = `${year}-${month}-01`
  const lastDay = new Date(year, today.getMonth() + 1, 0).getDate()
  const defaultEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [dateError, setDateError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  // [이슈 #2] 조회 트리거 — 0일 때는 테이블 미표시
  const [searchTrigger, setSearchTrigger] = useState(0)

  // 날짜 유효성 검증 후 조회 트리거 증가
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

  // PDF 다운로드 처리
  async function handleDownload() {
    if (!startDate || !endDate) {
      setDateError('시작일과 종료일을 모두 선택해주세요.')
      return
    }
    if (startDate > endDate) {
      setDateError('시작일은 종료일보다 이전이어야 합니다.')
      return
    }
    setDateError('')
    setIsDownloading(true)

    try {
      const res = await fetch('/api/admin/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, includeInactive }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        showToast((json as { error?: string }).error ?? 'PDF 생성에 실패했습니다.', 'error')
        return
      }

      // Blob으로 받아서 브라우저 다운로드 트리거
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `JunFire_Report_${startDate}_${endDate}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showToast('PDF 다운로드가 시작되었습니다.', 'success')
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">보고서</h1>
        <p className="text-sm text-gray-500 mt-1">기간을 선택하고 조회 후 PDF를 다운로드합니다.</p>
      </div>

      {/* 설정 카드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">기간 선택</h2>

        {/* 기간 선택 + 조회 버튼 */}
        <div className="mb-5">
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
            isLoading={isDownloading}
            error={dateError}
          />
        </div>

        {/* 비활성화 직원 포함 체크박스 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="includeInactive"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            disabled={isDownloading}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="includeInactive" className="text-sm text-gray-700">
            비활성화된 직원도 포함
          </label>
        </div>
      </div>

      {/* [이슈 #2] 조회 결과 섹션 — 조회 후 표시 */}
      {searchTrigger > 0 && (
        <>
          {/* 직원별 집계 섹션 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                직원별 집계 ({startDate} ~ {endDate})
              </h2>

              {/* PDF 다운로드 버튼 */}
              <Button
                variant="primary"
                onClick={handleDownload}
                isLoading={isDownloading}
                className="gap-2"
              >
                PDF 다운로드
              </Button>
            </div>

            {/* 직원별 집계 테이블 */}
            <SummaryTable
              startDate={startDate}
              endDate={endDate}
              includeInactive={includeInactive}
              searchTrigger={searchTrigger}
            />
          </div>

          {/* 날짜별 상세 섹션 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              날짜별 상세 기록 ({startDate} ~ {endDate})
            </h2>
            <DailyGrid
              startDate={startDate}
              endDate={endDate}
              includeInactive={includeInactive}
              searchTrigger={searchTrigger}
            />
          </div>

          {isDownloading && (
            <p className="text-xs text-gray-500">
              PDF를 생성 중입니다. 잠시 기다려주세요...
            </p>
          )}
        </>
      )}

      {/* 조회 전 안내 메시지 */}
      {searchTrigger === 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">보고서 안내</h3>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li>기간을 선택하고 조회 버튼을 클릭하면 직원별 집계를 확인할 수 있습니다.</li>
            <li>집계 확인 후 PDF 다운로드 버튼으로 보고서를 생성합니다.</li>
            <li>정상근무, 병가, 연차, 무급 상태가 모두 포함됩니다.</li>
            <li>PDF 파일로 다운로드되며 인쇄에 최적화되어 있습니다.</li>
          </ul>
        </div>
      )}
    </div>
  )
}
