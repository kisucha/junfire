// src/app/admin/staff/page.tsx
// 목적: 관리자 직원 관리 페이지 — 목록 조회, 신규 등록, 비활성화/재활성화
'use client'

import { useState } from 'react'
import StaffTable from '@/components/admin/StaffTable'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

/**
 * 직원 관리 페이지
 * - StaffTable: cursor 기반 직원 목록 + 비활성화/재활성화 버튼
 * - 직원 등록 모달 (인라인 폼)
 * - POST /api/admin/staff 호출
 */
export default function StaffPage() {
  const { showToast } = useToast()

  // 직원 등록 폼 표시 여부
  const [showForm, setShowForm] = useState(false)

  // 등록 폼 입력값
  const [formName, setFormName] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')

  // 폼 에러 메시지
  const [formErrors, setFormErrors] = useState<{
    name?: string
    username?: string
    password?: string
  }>({})

  // 등록 진행 중 여부
  const [isSaving, setIsSaving] = useState(false)

  // StaffTable 새로고침 트리거
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // 폼 유효성 검증
  function validate(): boolean {
    const errors: typeof formErrors = {}
    if (!formName.trim()) errors.name = '이름을 입력해주세요.'
    if (!formUsername.trim()) errors.username = '아이디를 입력해주세요.'
    else if (formUsername.trim().length < 2) errors.username = '아이디는 2자 이상이어야 합니다.'
    if (!formPassword) errors.password = '초기 비밀번호를 입력해주세요.'
    else if (formPassword.length < 4) errors.password = '비밀번호는 4자 이상이어야 합니다.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // 직원 등록 처리
  async function handleRegister() {
    if (!validate()) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          username: formUsername.trim(),
          password: formPassword,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '직원 등록에 실패했습니다.', 'error')
        return
      }

      showToast(`${formName} 직원이 등록되었습니다.`, 'success')

      // 폼 초기화 및 닫기
      setFormName('')
      setFormUsername('')
      setFormPassword('')
      setFormErrors({})
      setShowForm(false)

      // 목록 새로고침
      setRefreshTrigger((prev) => prev + 1)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // 폼 닫기 + 초기화
  function handleCancelForm() {
    setShowForm(false)
    setFormName('')
    setFormUsername('')
    setFormPassword('')
    setFormErrors({})
  }

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">직원 관리</h1>
        <p className="text-sm text-gray-500 mt-1">직원을 등록하거나 계정을 관리합니다.</p>
      </div>

      {/* 직원 등록 폼 (펼침/접힘) */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">신규 직원 등록</h2>
          <div className="space-y-3 max-w-sm">
            <Input
              label="이름"
              type="text"
              placeholder="홍길동"
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value)
                if (formErrors.name) setFormErrors((p) => ({ ...p, name: undefined }))
              }}
              error={formErrors.name}
              disabled={isSaving}
            />
            <Input
              label="아이디"
              type="text"
              placeholder="로그인 아이디 (영문/숫자)"
              value={formUsername}
              onChange={(e) => {
                setFormUsername(e.target.value)
                if (formErrors.username) setFormErrors((p) => ({ ...p, username: undefined }))
              }}
              error={formErrors.username}
              disabled={isSaving}
            />
            <Input
              label="초기 비밀번호"
              type="password"
              placeholder="4자 이상 입력"
              value={formPassword}
              onChange={(e) => {
                setFormPassword(e.target.value)
                if (formErrors.password) setFormErrors((p) => ({ ...p, password: undefined }))
              }}
              error={formErrors.password}
              disabled={isSaving}
            />

            <div className="flex gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleRegister}
                isLoading={isSaving}
              >
                등록
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelForm}
                disabled={isSaving}
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 직원 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <StaffTable
          onRegisterClick={() => setShowForm(true)}
          refreshTrigger={refreshTrigger}
        />
      </div>
    </div>
  )
}
