// src/components/admin/LocationManager.tsx
// 목적: 업무 현장 등록/수정/삭제/활성화 토글 관리 컴포넌트 — ADMIN 전용

'use client'

import { useState, useEffect, useCallback } from 'react'
import { WorkLocationDTO } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

/**
 * 업무 현장 관리 컴포넌트
 * - 현장 목록 조회 (GET /api/admin/locations)
 * - 현장 등록 (POST /api/admin/locations)
 * - 현장 이름 수정 (PATCH /api/admin/locations/[id])
 * - 활성/비활성 토글 (PATCH /api/admin/locations/[id])
 * - 현장 삭제 (DELETE /api/admin/locations/[id])
 */
export default function LocationManager() {
  const { showToast } = useToast()

  const [locations, setLocations] = useState<WorkLocationDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 신규 등록 폼
  const [newName, setNewName] = useState('')
  const [newNameError, setNewNameError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // 이름 수정 인라인 편집 상태 — 수정 중인 항목 id + 임시 이름
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<WorkLocationDTO | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadLocations = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/locations')
      const json = await res.json()
      if (!res.ok || !json.success) {
        showToast(json.error ?? '현장 목록 조회에 실패했습니다.', 'error')
        return
      }
      setLocations(json.data)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadLocations() }, [loadLocations])

  // 현장 등록
  async function handleAdd() {
    if (!newName.trim()) {
      setNewNameError('현장 이름을 입력해주세요.')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        showToast(json.error ?? '등록에 실패했습니다.', 'error')
        return
      }
      showToast('현장이 등록되었습니다.', 'success')
      setNewName('')
      setNewNameError('')
      loadLocations()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // 이름 수정 확정
  async function handleRename(id: string) {
    if (!editingName.trim()) return
    setIsRenaming(true)
    try {
      const res = await fetch(`/api/admin/locations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        showToast(json.error ?? '수정에 실패했습니다.', 'error')
        return
      }
      showToast('현장 이름이 수정되었습니다.', 'success')
      setEditingId(null)
      loadLocations()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsRenaming(false)
    }
  }

  // 활성/비활성 토글
  async function handleToggle(loc: WorkLocationDTO) {
    try {
      const res = await fetch(`/api/admin/locations/${loc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !loc.isActive }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        showToast(json.error ?? '변경에 실패했습니다.', 'error')
        return
      }
      showToast(loc.isActive ? '현장이 비활성화되었습니다.' : '현장이 활성화되었습니다.', 'success')
      loadLocations()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    }
  }

  // 현장 삭제
  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/locations/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        showToast(json.error ?? '삭제에 실패했습니다.', 'error')
        return
      }
      showToast('현장이 삭제되었습니다.', 'success')
      setDeleteTarget(null)
      loadLocations()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-800 mb-4">업무 현장 관리</h3>

      {/* 신규 등록 폼 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">현장 등록</h4>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="현장 이름"
              type="text"
              placeholder="예: 본사, 현장 A, 강남 현장"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (newNameError) setNewNameError('')
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              error={newNameError}
              disabled={isSaving}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            isLoading={isSaving}
            className="mb-0.5"
          >
            등록
          </Button>
        </div>
      </div>

      {/* 현장 목록 */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : locations.length === 0 ? (
        <p className="text-center text-gray-400 py-6 text-sm">등록된 현장이 없습니다.</p>
      ) : (
        <div className="space-y-1">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50"
            >
              {/* 이름 — 수정 중이면 인풋, 아니면 텍스트 */}
              {editingId === loc.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(loc.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  autoFocus
                  className="text-sm border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${loc.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                    {loc.name}
                  </span>
                  {!loc.isActive && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">비활성</span>
                  )}
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex items-center gap-1">
                {editingId === loc.id ? (
                  <>
                    <Button variant="primary" size="sm" onClick={() => handleRename(loc.id)} isLoading={isRenaming}>
                      저장
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      취소
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingId(loc.id); setEditingName(loc.name) }}
                    >
                      수정
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(loc)}
                    >
                      {loc.isActive ? '비활성화' : '활성화'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(loc)}
                      className="text-red-500 hover:text-red-700"
                    >
                      삭제
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="현장 삭제"
          message={`"${deleteTarget.name}"을(를) 삭제하시겠습니까? 기존 업무 기록의 현장 데이터는 유지됩니다.`}
          confirmText="삭제"
          isLoading={isDeleting}
          variant="danger"
        />
      )}
    </div>
  )
}
