// src/app/drawings/page.tsx
// 목적: 도면 게시판 목록 페이지 — 직원·관리자 모두 열람 및 업로드 가능
// - 직원·관리자 모두 도면 업로드 가능 (POST /api/drawings)
// - 본인 등록 도면 또는 ADMIN은 수정/삭제 가능 (PUT/DELETE /api/drawings/[id])
// - 현장명 드롭다운: WorkLocation DB 목록 + "기타" 직접 입력
// - 구분 select: 1st, 2nd, RCP (기본 1st)
// - 등록일 최신순 정렬 (API에서 createdAt DESC 보장)
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DrawingDTO } from '@/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

// WorkLocation 드롭다운 옵션 타입
interface LocationOption {
  id: string
  name: string
}

// 구분 타입 정의
type DrawingType = '1st' | '2nd' | 'RCP' | '기타'
const DRAWING_TYPES: DrawingType[] = ['1st', '2nd', 'RCP', '기타']

/**
 * 도면 게시판 목록 페이지
 * - 현장명 드롭다운 + "기타" 직접 입력
 * - 구분 select (1st, 2nd, RCP)
 * - 업로드 폼 토글 (접기/펼치기)
 * - 본인 도면만 수정/삭제 버튼 표시 (ADMIN은 전체 표시)
 * - 수정 모달: div overlay 기반
 * - 행 클릭 → /drawings/[id] 이동 (PDF 뷰어)
 */
export default function DrawingsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { data: session } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 현재 로그인 사용자 정보 (수정/삭제 권한 확인용)
  const currentUserId = session?.user?.id ?? ''
  const isAdmin = session?.user?.role === 'ADMIN'

  // 도면 목록 상태
  const [drawings, setDrawings] = useState<DrawingDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 검색 필터 — 현장명
  const [searchTerm, setSearchTerm] = useState('')

  // WorkLocation 현장명 드롭다운 목록
  const [locations, setLocations] = useState<LocationOption[]>([])

  // 업로드 폼 토글
  const [showUploadForm, setShowUploadForm] = useState(false)

  // 업로드 폼 상태
  // siteNameMode: 'select' = 드롭다운 선택, 'other' = 직접 입력
  const [siteNameMode, setSiteNameMode] = useState<'select' | 'other'>('select')
  const [siteName, setSiteName] = useState('')          // 선택된 현장명 또는 기타 입력값
  const [siteNameOther, setSiteNameOther] = useState('') // "기타" 선택 시 직접 입력값
  const [floor, setFloor] = useState('')
  const [drawingType, setDrawingType] = useState<DrawingType>('1st') // 구분 (기본 '1st')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // 수정 모달 상태
  const [editTarget, setEditTarget] = useState<DrawingDTO | null>(null)
  const [editSiteNameMode, setEditSiteNameMode] = useState<'select' | 'other'>('select')
  const [editSiteName, setEditSiteName] = useState('')
  const [editSiteNameOther, setEditSiteNameOther] = useState('')
  const [editFloor, setEditFloor] = useState('')
  const [editType, setEditType] = useState<DrawingType>('1st')
  const [editFile, setEditFile] = useState<File | null>(null)  // 파일 교체용 (선택)
  const [isSaving, setIsSaving] = useState(false)

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

  useEffect(() => {
    fetchDrawings()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 현장명 드롭다운 변경 핸들러 (업로드 폼)
  function handleSiteNameSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value === '__OTHER__') {
      // "기타" 선택 시 직접 입력 모드 전환
      setSiteNameMode('other')
      setSiteName('')
      setSiteNameOther('')
    } else {
      setSiteNameMode('select')
      setSiteName(value)
    }
  }

  // "기타" 직접 입력 → siteName 동기화 (업로드 폼)
  function handleSiteNameOtherChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSiteNameOther(e.target.value)
    setSiteName(e.target.value)
  }

  // 드롭다운으로 돌아가기 (업로드 폼)
  function handleBackToSelect() {
    setSiteNameMode('select')
    setSiteNameOther('')
    if (locations.length > 0) {
      setSiteName(locations[0].name)
    } else {
      setSiteName('')
    }
  }

  // 수정 모달 열기
  function handleEditOpen(drawing: DrawingDTO) {
    setEditTarget(drawing)
    const inList = locations.some((l) => l.name === drawing.siteName)
    if (inList) {
      setEditSiteNameMode('select')
      setEditSiteName(drawing.siteName)
      setEditSiteNameOther('')
    } else {
      setEditSiteNameMode('other')
      setEditSiteName(drawing.siteName)
      setEditSiteNameOther(drawing.siteName)
    }
    setEditFloor(drawing.floor)
    setEditType((drawing.type as DrawingType) ?? '1st')
    setEditFile(null)  // 파일 교체 초기화
  }

  // 수정 모달 현장명 드롭다운 변경
  function handleEditSiteNameSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value === '__OTHER__') {
      setEditSiteNameMode('other')
      setEditSiteName('')
      setEditSiteNameOther('')
    } else {
      setEditSiteNameMode('select')
      setEditSiteName(value)
    }
  }

  // 수정 모달 "기타" 직접 입력
  function handleEditSiteNameOtherChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEditSiteNameOther(e.target.value)
    setEditSiteName(e.target.value)
  }

  // 수정 모달 드롭다운으로 돌아가기
  function handleEditBackToSelect() {
    setEditSiteNameMode('select')
    setEditSiteNameOther('')
    if (locations.length > 0) {
      setEditSiteName(locations[0].name)
    } else {
      setEditSiteName('')
    }
  }

  // 수정 저장 처리 — multipart/form-data (파일 교체 포함)
  async function handleEditSave() {
    if (!editTarget) return
    const finalSiteName = editSiteNameMode === 'other' ? editSiteNameOther.trim() : editSiteName.trim()
    if (!finalSiteName) { showToast('현장명을 입력해주세요.', 'error'); return }
    if (!editFloor.trim()) { showToast('층을 입력해주세요.', 'error'); return }

    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append('siteName', finalSiteName)
      formData.append('floor', editFloor.trim())
      formData.append('type', editType)
      // 파일이 선택된 경우만 전송 — 없으면 API에서 기존 파일 유지
      if (editFile) formData.append('file', editFile)

      const res = await fetch(`/api/drawings/${editTarget.id}`, {
        method: 'PUT',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok || !json.success) { showToast(json.error ?? '수정에 실패했습니다.', 'error'); return }
      showToast('수정되었습니다.', 'success')
      setEditTarget(null)
      setEditFile(null)
      await fetchDrawings()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsSaving(false)
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

  // 파일 크기 표시 형식 변환
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 등록일 표시 형식 변환 (YYYY-MM-DD)
  function formatDate(isoStr: string): string {
    const d = new Date(isoStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // 업로드 처리
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
      formData.append('type', drawingType)
      formData.append('file', selectedFile)

      const res = await fetch('/api/drawings', {
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
        setSiteNameOther('')
        setSiteName('')
      }
      setFloor('')
      setDrawingType('1st')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setShowUploadForm(false)

      // 목록 새로고침
      await fetchDrawings()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  // 삭제 처리 — /api/drawings/[id] DELETE 사용 (본인 또는 ADMIN)
  async function handleDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/drawings/${deleteTarget.id}`, {
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

  // 현장명, 층, 파일명 검색 필터 적용
  const filtered = drawings.filter((d) => {
    const q = searchTerm.toLowerCase()
    return (
      d.siteName.toLowerCase().includes(q) ||
      d.floor.toLowerCase().includes(q) ||
      d.fileName.toLowerCase().includes(q)
    )
  })

  // 수정 버튼 표시 여부 — 로그인 사용자 누구나 가능
  function canEdit(): boolean {
    return !!currentUserId
  }

  // 삭제 버튼 표시 여부 — 본인 등록 도면 또는 ADMIN
  function canDelete(drawing: DrawingDTO): boolean {
    return isAdmin || drawing.createdBy === currentUserId
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 + 도면 등록 버튼 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">도면 게시판</h1>
          <p className="text-sm text-gray-500 mt-1">
            현장별 도면을 조회합니다. 항목을 클릭하면 도면을 볼 수 있습니다.
          </p>
        </div>
        {/* 업로드 폼 토글 버튼 */}
        <Button
          variant={showUploadForm ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setShowUploadForm((prev) => !prev)}
        >
          {showUploadForm ? '닫기' : '도면 등록'}
        </Button>
      </div>

      {/* 업로드 폼 (토글) */}
      {showUploadForm && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">도면 등록</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* 현장명 드롭다운 + "기타" 직접 입력 */}
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
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                    <option value="__OTHER__">기타 (직접 입력)</option>
                  </select>
                  {locations.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      등록된 현장이 없습니다. 직접 입력하거나 관리자에게 문의하세요.
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                층
              </label>
              <input
                type="text"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="예: 1층, 2층, 지하 1층"
                disabled={isUploading}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50"
              />
            </div>

            {/* 구분 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                구분
              </label>
              <select
                value={drawingType}
                onChange={(e) => setDrawingType(e.target.value as DrawingType)}
                disabled={isUploading}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50 disabled:bg-gray-50"
              >
                {DRAWING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
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

          {/* 업로드 + 취소 버튼 */}
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleUpload}
              isLoading={isUploading}
              disabled={isUploading}
            >
              도면 등록
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowUploadForm(false)}
              disabled={isUploading}
            >
              취소
            </Button>
          </div>
        </div>
      )}

      {/* 검색 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <input
          type="text"
          placeholder="현장명, 층, 파일명으로 검색..."
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
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">구분</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600 hidden sm:table-cell">파일명</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">크기</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">등록일</th>
                  <th className="px-5 py-3 text-center font-semibold text-gray-600">수정</th>
                  <th className="px-5 py-3 text-center font-semibold text-gray-600">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((drawing) => (
                  <tr
                    key={drawing.id}
                    className="hover:bg-blue-50 transition-colors"
                  >
                    {/* 행 클릭 → PDF 뷰어 이동 (수정/삭제 버튼 제외) */}
                    <td
                      className="px-5 py-4 font-medium text-gray-800 cursor-pointer"
                      onClick={() => router.push(`/drawings/${drawing.id}`)}
                    >
                      {drawing.siteName}
                    </td>
                    <td
                      className="px-5 py-4 text-gray-600 cursor-pointer"
                      onClick={() => router.push(`/drawings/${drawing.id}`)}
                    >
                      {drawing.floor}
                    </td>
                    <td
                      className="px-5 py-4 text-gray-600 cursor-pointer"
                      onClick={() => router.push(`/drawings/${drawing.id}`)}
                    >
                      {drawing.type ?? '-'}
                    </td>
                    <td
                      className="px-5 py-4 text-gray-500 hidden sm:table-cell max-w-xs truncate cursor-pointer"
                      onClick={() => router.push(`/drawings/${drawing.id}`)}
                    >
                      {drawing.fileName}
                    </td>
                    <td
                      className="px-5 py-4 text-gray-500 hidden md:table-cell cursor-pointer"
                      onClick={() => router.push(`/drawings/${drawing.id}`)}
                    >
                      {formatFileSize(drawing.fileSize)}
                    </td>
                    <td
                      className="px-5 py-4 text-gray-500 cursor-pointer"
                      onClick={() => router.push(`/drawings/${drawing.id}`)}
                    >
                      {formatDate(drawing.createdAt)}
                    </td>
                    {/* 수정 버튼 — 로그인 사용자 누구나 */}
                    <td className="px-5 py-4 text-center">
                      {canEdit() ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditOpen(drawing)
                          }}
                        >
                          수정
                        </Button>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                    {/* 삭제 버튼 — 본인 등록 또는 ADMIN만 */}
                    <td className="px-5 py-4 text-center">
                      {canDelete(drawing) ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(drawing)
                          }}
                        >
                          삭제
                        </Button>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
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

      {/* 수정 모달 (div overlay) */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">도면 정보 수정</h3>

            {/* 현장명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">현장명</label>
              {editSiteNameMode === 'select' ? (
                <div>
                  <select
                    value={editSiteName}
                    onChange={handleEditSiteNameSelectChange}
                    disabled={isSaving}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      disabled:opacity-50 disabled:bg-gray-50"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                    <option value="__OTHER__">기타 (직접 입력)</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editSiteNameOther}
                    onChange={handleEditSiteNameOtherChange}
                    placeholder="현장명을 직접 입력하세요"
                    disabled={isSaving}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      disabled:opacity-50"
                  />
                  {locations.length > 0 && (
                    <button
                      type="button"
                      onClick={handleEditBackToSelect}
                      disabled={isSaving}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">층</label>
              <input
                type="text"
                value={editFloor}
                onChange={(e) => setEditFloor(e.target.value)}
                placeholder="예: 1층, 2층, 지하 1층"
                disabled={isSaving}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50"
              />
            </div>

            {/* 구분 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">구분</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as DrawingType)}
                disabled={isSaving}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50 disabled:bg-gray-50"
              >
                {DRAWING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* 파일 교체 (선택) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                파일 교체 <span className="text-gray-400 font-normal">(선택 — 비워두면 기존 파일 유지)</span>
              </label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={isSaving}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  if (f && f.type !== 'application/pdf') {
                    showToast('PDF 파일만 선택할 수 있습니다.', 'error')
                    e.target.value = ''
                    setEditFile(null)
                    return
                  }
                  setEditFile(f)
                }}
                className="block w-full text-sm text-gray-600
                  file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0
                  file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100 cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {editFile && (
                <p className="text-xs text-blue-600 mt-1">
                  교체할 파일: {editFile.name} ({formatFileSize(editFile.size)})
                </p>
              )}
              {editTarget && !editFile && (
                <p className="text-xs text-gray-400 mt-1">
                  현재 파일: {editTarget.fileName}
                </p>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleEditSave}
                isLoading={isSaving}
                disabled={isSaving}
              >
                저장
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditTarget(null)}
                disabled={isSaving}
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

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
