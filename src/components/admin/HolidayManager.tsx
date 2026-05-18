// src/components/admin/HolidayManager.tsx
// 목적: 공휴일 등록/삭제 관리 컴포넌트
'use client'

import { useState, useEffect, useCallback } from 'react'
import { HolidayDTO } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'

/**
 * 공휴일 관리 컴포넌트
 * - 공휴일 목록 조회 (GET /api/admin/holidays)
 * - 공휴일 등록 (POST /api/admin/holidays)
 * - 공휴일 삭제 (DELETE /api/admin/holidays/[id])
 */
export default function HolidayManager() {
  const { showToast } = useToast()

  // 공휴일 목록 상태
  const [holidays, setHolidays] = useState<HolidayDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 신규 등록 폼 상태
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [formErrors, setFormErrors] = useState<{ date?: string; name?: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  // 삭제 확인 모달 상태
  const [deleteTarget, setDeleteTarget] = useState<HolidayDTO | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 공휴일 목록 로드
  const loadHolidays = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/holidays?take=100')
      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '공휴일 목록 조회에 실패했습니다.', 'error')
        return
      }
      setHolidays(json.data)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadHolidays()
  }, [loadHolidays])

  // 공휴일 등록 처리
  async function handleAdd() {
    const errors: { date?: string; name?: string } = {}
    if (!newDate) errors.date = '날짜를 선택해주세요.'
    if (!newName.trim()) errors.name = '공휴일 이름을 입력해주세요.'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, name: newName.trim() }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '등록에 실패했습니다.', 'error')
        return
      }

      showToast('공휴일이 등록되었습니다.', 'success')
      setNewDate('')
      setNewName('')
      setFormErrors({})
      loadHolidays()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // 공휴일 삭제 처리
  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/admin/holidays/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '삭제에 실패했습니다.', 'error')
        return
      }

      showToast('공휴일이 삭제되었습니다.', 'success')
      setDeleteTarget(null)
      loadHolidays()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-800 mb-4">공휴일 관리</h3>

      {/* 신규 등록 폼 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">공휴일 등록</h4>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input
              label="날짜"
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value)
                if (formErrors.date) setFormErrors((p) => ({ ...p, date: undefined }))
              }}
              error={formErrors.date}
              disabled={isSaving}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Input
              label="공휴일 이름"
              type="text"
              placeholder="예: 추석"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (formErrors.name) setFormErrors((p) => ({ ...p, name: undefined }))
              }}
              error={formErrors.name}
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

      {/* 공휴일 목록 */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : holidays.length === 0 ? (
        <p className="text-center text-gray-400 py-6 text-sm">등록된 공휴일이 없습니다.</p>
      ) : (
        <div className="space-y-1">
          {holidays.map((holiday) => (
            <div
              key={holiday.id}
              className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {/* 날짜 */}
                <span className="text-sm font-medium text-gray-700 w-28">
                  {holiday.date.slice(0, 10)}
                </span>
                {/* 이름 */}
                <span className="text-sm text-gray-600">{holiday.name}</span>
              </div>
              {/* 삭제 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(holiday)}
              >
                삭제
              </Button>
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
          title="공휴일 삭제"
          message={`"${deleteTarget.name}" (${deleteTarget.date.slice(0, 10)})을 삭제하시겠습니까?`}
          confirmText="삭제"
          isLoading={isDeleting}
          variant="danger"
        />
      )}
    </div>
  )
}
