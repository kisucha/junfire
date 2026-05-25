// src/app/admin/drawings/page.tsx
// 목적: 관리자 도면 관리 페이지 — 업로드 / 목록 / 삭제
// 현장명: WorkLocation DB 목록 드롭다운 + "기타" 직접 입력 지원
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DrawingDTO } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

// WorkLocation 드롭다운 옵션 타입
interface LocationOption {
  id: string
  name: string
}

/**
 * 관리자 도면 관리 페이지
 * - 도면 업로드 폼 (현장명 드롭다운/기타, 층, PDF 파일)
 * - 도면 목록 테이블 (현장명, 층, 파일명, 크기, 등록일, 뷰어 이동, 삭제)
 * - 삭제: 확인 모달 후 DELETE 요청
 */
export default function AdminDrawingsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 도면 목록
  const [drawings, setDrawings] = useState<DrawingDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // WorkLocation 현장명 드롭다운 목록
  const [locations, setLocations] = useState<LocationOption[]>([])

  // 업로드 폼 상태
  // siteNameMode: 'select' = 드롭다운 선택, 'other' = 직접 입력
  const [siteNameMode, setSiteNameMode] = useState<'select' | 'other'>('select')
  const [siteName, setSiteName] = useState('')         // select 선택값 또는 기타 입력값
  const [siteNameOther, setSiteNameOther] = useState('') // "기타" 선택 시 직접 입력
  const [floor, setFloor] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<DrawingDTO | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // WorkLocation 목록 로드
  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await fetch('/api/worklocation')
        const json = await res.json()
        if (res.ok && json.success) {
          setLocations(json.data)
          // 첫 번째 현장명 기본 선택
          if (json.data.length > 0) {
            setSiteName(json.data[0].name)
          }
        }
      } catch {
        // 현장명 목록 조회 실패 시 직접 입력 모드로 전환
        setSiteNameMode('other')
      }
    }
    fetchLocations()
  }, [])

  // 도면 목록 로드
  async function fetchDrawings() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/drawings')
      const json = await res.json()
      if (!res.ok || !json.success) {
        showToast(json.error ?? '목록 조회에 실패했습니다.', 'error')
        return
      }
      setDrawings(json.data)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchDrawings() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 현장명 드롭다운 변경 핸들러
  function handleSiteNameSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value === '__OTHER__') {
      // "기타" 선택 시 직접 입력 모드로 전환
      setSiteNameMode('other')
      setSiteName('')
      setSiteNameOther('')
    } else {
      setSiteNameMode('select')
      setSiteName(value)
    }
  }

  // "기타" 직접 입력 → siteName 동기화
  function handleSiteNameOtherChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSiteNameOther(e.target.value)
    setSiteName(e.target.value)
  }

  // 드롭다운으로 돌아가기
  function handleBackToSelect() {
    setSiteNameMode('select')
    setSiteNameOther('')
    // 첫 번째 현장으로 초기화
    if (locations.length > 0) {
      setSiteName(locations[0].name)
    } else {
      setSiteName('')
    }
  }

  // 파일 선택 핸들러
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file && file.type !== 'application/pdf') {
      showToast('PDF 파일만 선택할 수 있습니다.', 'error')
      e.target.value = ''
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }

  // 업로드 처리 (관리자 전용 엔드포인트 사용)
  async function handleUpload() {
    const finalSiteName = siteNameMode === 'other' ? siteNameOther.trim() : siteName.trim()
    if (!finalSiteName) { showToast('현장명을 입력해주세요.', 'error'); return }
    if (!floor.trim()) { showToast('층을 입력해주세요.', 'error'); return }
    if (!selectedFile) { showToast('PDF 파일을 선택해주세요.', 'error'); return }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('siteName', finalSiteName)
      formData.append('floor', floor.trim())
      formData.append('file', selectedFile)

      const res = await fetch('/api/admin/drawings', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '업로드에 실패했습니다.', 'error')
        return
      }

      showToast('도면이 등록되었습니다.', 'success')

      // 폼 초기화
      if (siteNameMode === 'select' && locations.length > 0) {
        setSiteName(locations[0].name)
      } else {
        setSiteNameMode('other')
        setSiteNameOther('')
        setSiteName('')
      }
      setFloor('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      await fetchDrawings()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  // 삭제 처리 (관리자 전용 엔드포인트 사용)
  async function handleDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/drawings/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (res.status === 204) {
        showToast('삭제되었습니다.', 'success')
        setDeleteTarget(null)
        await fetchDrawings()
        return
      }

      const json = await res.json()
      showToast(json.error ?? '삭제에 실패했습니다.', 'error')
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // 파일 크기 표시 형식
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 등록일 형식 (YYYY-MM-DD)
  function formatDate(isoStr: string): string {
    const d = new Date(isoStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">도면 관리</h1>
        <p className="text-sm text-gray-500 mt-1">도면 PDF를 업로드하고 관리합니다.</p>
      </div>

      {/* 업로드 폼 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">도면 등록</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* 현장명 — WorkLocation 드롭다운 + "기타" 직접 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              현장명
            </label>
            {siteNameMode === 'select' ? (
              <div>
                <select
                  value={siteName}
                  onChange={handleSiteNameSelectChange}
                  disabled={isUploading}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    disabled:opacity-50 disabled:bg-gray-50"
                >
                  {/* 등록된 현장명 목록 */}
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                  {/* 기타: 직접 입력 옵션 */}
                  <option value="__OTHER__">기타 (직접 입력)</option>
                </select>
                {locations.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    등록된 현장이 없습니다. 현장 관리에서 추가하거나 직접 입력하세요.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={siteNameOther}
                  onChange={handleSiteNameOtherChange}
                  placeholder="현장명을 직접 입력하세요"
                  disabled={isUploading}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    disabled:opacity-50"
                />
                {/* 드롭다운으로 돌아가기 버튼 (현장 목록이 있을 때만) */}
                {locations.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBackToSelect}
                    disabled={isUploading}
                    className="px-3 py-2 text-xs text-blue-600 border border-blue-300 rounded-md
                      hover:bg-blue-50 disabled:opacity-50"
                  >
                    목록
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 층 */}
          <Input
            label="층"
            type="text"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="예: 1층, 2층, 지하 1층"
            disabled={isUploading}
          />
        </div>

        {/* PDF 파일 선택 */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            도면 파일 (PDF)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-gray-600
              file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0
              file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {selectedFile && (
            <p className="text-xs text-gray-500 mt-1">
              선택됨: {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          )}
        </div>

        {/* 업로드 버튼 */}
        <Button
          variant="primary"
          onClick={handleUpload}
          isLoading={isUploading}
          disabled={isUploading}
        >
          도면 등록
        </Button>
      </div>

      {/* 도면 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            등록된 도면 ({drawings.length}건)
          </h2>
          {/* 직원 게시판으로 이동 */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/drawings')}
          >
            게시판 보기
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : drawings.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            등록된 도면이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">현장명</th>
                  <th className="px-4 py-3 text-left font-medium">층</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">파일명</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">크기</th>
                  <th className="px-4 py-3 text-left font-medium">등록일</th>
                  <th className="px-4 py-3 text-center font-medium">보기</th>
                  <th className="px-4 py-3 text-center font-medium">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drawings.map((drawing) => (
                  <tr key={drawing.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{drawing.siteName}</td>
                    <td className="px-4 py-3 text-gray-600">{drawing.floor}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell max-w-xs truncate">
                      {drawing.fileName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {formatFileSize(drawing.fileSize)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(drawing.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/drawings/${drawing.id}`)}
                      >
                        보기
                      </Button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(drawing)}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="도면 삭제"
        message={`"${deleteTarget?.siteName} ${deleteTarget?.floor}" 도면을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  )
}
