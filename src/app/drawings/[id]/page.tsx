// src/app/drawings/[id]/page.tsx
// 목적: 도면 PDF 뷰어 페이지 — 브라우저 내장 PDF 뷰어로 도면 표시
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DrawingDTO } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

/**
 * 도면 PDF 뷰어 페이지
 * - /api/drawings/[id] 에서 메타데이터 조회
 * - /api/drawings/[id]/file 에서 PDF 스트리밍 → iframe으로 표시
 * - 뒤로가기 버튼 → /drawings 목록
 */
export default function DrawingViewerPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()

  // URL params에서 id 추출
  const id = typeof params.id === 'string' ? params.id : ''

  // 도면 메타데이터
  const [drawing, setDrawing] = useState<DrawingDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 메타데이터 조회 (목록 API 사용 후 id 필터)
  useEffect(() => {
    if (!id) return

    async function fetchDrawing() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/drawings')
        const json = await res.json()
        if (!res.ok || !json.success) {
          showToast('도면 정보를 불러오지 못했습니다.', 'error')
          return
        }
        const found = (json.data as DrawingDTO[]).find((d) => d.id === id)
        if (!found) {
          showToast('해당 도면을 찾을 수 없습니다.', 'error')
          router.push('/drawings')
          return
        }
        setDrawing(found)
      } catch {
        showToast('네트워크 오류가 발생했습니다.', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDrawing()
  }, [id, router, showToast])

  return (
    <div className="space-y-4">
      {/* 헤더 영역 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/drawings')}
        >
          ← 목록
        </Button>

        {drawing && (
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              {drawing.siteName} — {drawing.floor}
            </h1>
            <p className="text-xs text-gray-500">{drawing.fileName}</p>
          </div>
        )}
      </div>

      {/* PDF 뷰어 영역 */}
      {isLoading ? (
        <div className="flex justify-center py-20 bg-white rounded-xl border border-gray-200">
          <LoadingSpinner size="lg" />
        </div>
      ) : drawing ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* 브라우저 내장 PDF 뷰어 — inline 표시 */}
          <iframe
            src={`/api/drawings/${id}/file`}
            title={`${drawing.siteName} ${drawing.floor} 도면`}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          도면을 불러올 수 없습니다.
        </div>
      )}
    </div>
  )
}
