// src/app/drawings/page.tsx
// 목적: 도면 게시판 목록 페이지 — 직원·관리자 모두 열람 가능
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DrawingDTO } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

/**
 * 도면 게시판 목록 페이지
 * - 현장명 기준 검색 필터
 * - 행 클릭 → /drawings/[id] 이동 (PDF 뷰어)
 * - 등록일 내림차순 정렬
 */
export default function DrawingsPage() {
  const router = useRouter()
  const { showToast } = useToast()

  // 도면 목록 상태
  const [drawings, setDrawings] = useState<DrawingDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 검색 필터 — 현장명
  const [searchTerm, setSearchTerm] = useState('')

  // 도면 목록 로드
  useEffect(() => {
    async function fetchDrawings() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/drawings')
        const json = await res.json()
        if (!res.ok || !json.success) {
          showToast(json.error ?? '도면 목록 조회에 실패했습니다.', 'error')
          return
        }
        setDrawings(json.data)
      } catch {
        showToast('네트워크 오류가 발생했습니다.', 'error')
      } finally {
        setIsLoading(false)
      }
    }
    fetchDrawings()
  }, [showToast])

  // 현장명 검색 필터 적용
  const filtered = drawings.filter((d) =>
    d.siteName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 파일 크기 표시 형식 변환
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 등록일 표시 형식 변환
  function formatDate(isoStr: string): string {
    const d = new Date(isoStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">도면 게시판</h1>
        <p className="text-sm text-gray-500 mt-1">현장별 도면을 조회합니다. 항목을 클릭하면 도면을 볼 수 있습니다.</p>
      </div>

      {/* 검색 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <input
          type="text"
          placeholder="현장명으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 도면 목록 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">
            {searchTerm ? '검색 결과가 없습니다.' : '등록된 도면이 없습니다.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">현장명</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">층</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600 hidden sm:table-cell">파일명</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">크기</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((drawing) => (
                  <tr
                    key={drawing.id}
                    onClick={() => router.push(`/drawings/${drawing.id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4 font-medium text-gray-800">
                      {drawing.siteName}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {drawing.floor}
                    </td>
                    <td className="px-5 py-4 text-gray-500 hidden sm:table-cell max-w-xs truncate">
                      {drawing.fileName}
                    </td>
                    <td className="px-5 py-4 text-gray-500 hidden md:table-cell">
                      {formatFileSize(drawing.fileSize)}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {formatDate(drawing.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 목록 건수 */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          총 {filtered.length}건
        </p>
      )}
    </div>
  )
}
