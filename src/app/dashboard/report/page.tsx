// src/app/dashboard/report/page.tsx
// 목적: 직원 업무내용 제공 페이지 — 기간 선택 후 날짜별 업무 기록 + 총 근무시간 표시
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { WorkRecordDTO, StatusLabel } from '@/types'
import Button from '@/components/ui/Button'
import { formatHoursToDisplay } from '@/lib/utils/time'
import { getDayOfWeekKo } from '@/lib/utils/date'
import { useToast } from '@/components/ui/Toast'

// 상태별 근무시간 표시 — WORK=실제시간, SICK/ANNUAL/HOLIDAY=8h 고정, UNPAID=-
function getHoursDisplay(record: WorkRecordDTO): string {
  if (record.status === 'WORK') {
    return record.totalHours != null ? formatHoursToDisplay(record.totalHours) : '-'
  }
  if (record.status === 'SICK' || record.status === 'ANNUAL' || record.status === 'HOLIDAY') {
    return '8시간 (고정)'
  }
  return '-'
}

// 상태별 뱃지 스타일
const STATUS_BADGE: Record<string, string> = {
  WORK:    'bg-green-100 text-green-800',
  SICK:    'bg-red-100 text-red-800',
  ANNUAL:  'bg-blue-100 text-blue-800',
  UNPAID:  'bg-gray-100 text-gray-700',
  HOLIDAY: 'bg-yellow-100 text-yellow-800',
}

export default function EmployeeReportPage() {
  const { data: session } = useSession()
  const router = useRouter()
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
  const [dateError, setDateError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [records, setRecords] = useState<WorkRecordDTO[]>([])
  const [totalHoursSum, setTotalHoursSum] = useState(0)

  async function handleSearch() {
    if (!startDate || !endDate) {
      setDateError('시작일과 종료일을 모두 선택해주세요.')
      return
    }
    if (startDate > endDate) {
      setDateError('시작일은 종료일보다 이전이어야 합니다.')
      return
    }
    setDateError('')
    setIsLoading(true)

    try {
      const res = await fetch(
        `/api/records/my-report?startDate=${startDate}&endDate=${endDate}`
      )
      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '조회에 실패했습니다.', 'error')
        return
      }

      setRecords(json.data ?? [])
      setTotalHoursSum(json.totalHoursSum ?? 0)
      setSearched(true)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // PDF 다운로드 — 조회 결과를 서버에서 PDF로 생성하여 파일 저장
  async function handlePdfDownload() {
    setIsPdfLoading(true)
    try {
      const res = await fetch(
        `/api/records/my-report/pdf?startDate=${startDate}&endDate=${endDate}`
      )
      if (!res.ok) {
        showToast('PDF 생성에 실패했습니다.', 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const name = session?.user?.name ?? 'unknown'
      a.download = `JunFire_업무기록_${name}_${startDate}_${endDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('PDF 다운로드 중 오류가 발생했습니다.', 'error')
    } finally {
      setIsPdfLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 네비게이션 바 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard')}
              aria-label="메뉴로 돌아가기"
            >
              ← 메뉴
            </Button>
            <span className="font-bold text-gray-800 hidden sm:inline">JunFire Protection</span>
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <span className="text-sm text-gray-600">{session.user.name}</span>
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
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">업무내용 제공</h1>
          <p className="text-sm text-gray-500 mt-1">
            기간을 선택하면 해당 기간의 업무 내역을 확인할 수 있습니다.
          </p>
        </div>

        {/* 기간 선택 카드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">기간 선택</h2>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (dateError) setDateError('')
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <span className="text-gray-400 pb-2 hidden sm:inline">~</span>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  if (dateError) setDateError('')
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSearch}
              isLoading={isLoading}
              className="sm:self-end"
            >
              조회
            </Button>
          </div>
          {dateError && (
            <p className="mt-2 text-xs text-red-500">{dateError}</p>
          )}
        </div>

        {/* 조회 결과 */}
        {searched && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                조회 결과 ({startDate} ~ {endDate})
              </h2>
              {records.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePdfDownload}
                  isLoading={isPdfLoading}
                >
                  PDF 다운로드
                </Button>
              )}
            </div>

            {records.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                해당 기간에 업무 기록이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                        날짜
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                        업무상태
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                        근무시간
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                        업무현장
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">
                        업무내용
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {records.map((record) => {
                      const dateStr = record.date.slice(0, 10)
                      const dow = getDayOfWeekKo(dateStr)
                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-medium">
                            {dateStr} ({dow})
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={[
                                'inline-block px-2 py-0.5 rounded text-xs font-medium',
                                STATUS_BADGE[record.status] ?? '',
                              ].join(' ')}
                            >
                              {StatusLabel[record.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                            {getHoursDisplay(record)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                            {record.location ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs">
                            <span className="line-clamp-2">
                              {record.description ?? '-'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* 합계 행 */}
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td
                        colSpan={2}
                        className="px-4 py-3 text-xs font-semibold text-gray-700"
                      >
                        총 {records.length}건
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">
                        {formatHoursToDisplay(totalHoursSum)}
                      </td>
                      <td colSpan={2} className="px-4 py-3 text-xs text-gray-400">
                        * 병가·연차·공휴일 8시간 고정, 무급 제외
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 조회 전 안내 */}
        {!searched && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">조회 안내</h3>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>기간을 선택하고 조회 버튼을 클릭하세요.</li>
              <li>정상근무, 병가, 연차, 공휴일, 무급 기록이 모두 표시됩니다.</li>
              <li>병가·연차·공휴일은 8시간으로 집계됩니다.</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
