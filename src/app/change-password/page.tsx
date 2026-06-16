// src/app/change-password/page.tsx
// 목적: 최초 로그인 비밀번호 강제 변경 페이지
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

/**
 * 비밀번호 변경 페이지
 * - 현재 비밀번호, 새 비밀번호, 새 비밀번호 확인 입력
 * - PUT /api/password 호출
 * - 성공 시 session update 후 role에 맞는 페이지로 리다이렉트
 */
export default function ChangePasswordPage() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const { showToast } = useToast()

  // 폼 입력값 상태
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // 필드별 에러 메시지
  const [errors, setErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})

  // 저장 진행 중 여부
  const [isLoading, setIsLoading] = useState(false)

  // 세션 업데이트 완료 후 리다이렉트 대기 플래그
  const [waitingRedirect, setWaitingRedirect] = useState(false)

  // session.isFirstLogin이 false로 바뀌면 이동 — updateSession 쿠키 반영 타이밍 보장
  useEffect(() => {
    if (waitingRedirect && session?.user.isFirstLogin === false) {
      if (session.user.role === 'ADMIN') {
        router.replace('/admin')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [waitingRedirect, session?.user.isFirstLogin, session?.user.role, router])

  // 유효성 검증
  function validate(): boolean {
    const newErrors: typeof errors = {}

    if (!currentPassword) {
      newErrors.currentPassword = '현재 비밀번호를 입력해주세요.'
    }

    if (!newPassword) {
      newErrors.newPassword = '새 비밀번호를 입력해주세요.'
    } else if (newPassword.length < 4) {
      newErrors.newPassword = '새 비밀번호는 4자 이상이어야 합니다.'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = '새 비밀번호를 한 번 더 입력해주세요.'
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = '새 비밀번호가 일치하지 않습니다.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 비밀번호 변경 처리
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)

    try {
      const res = await fetch('/api/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        // 현재 비밀번호 오류인지 일반 오류인지 구분
        if (res.status === 401 || json.error?.includes('현재 비밀번호')) {
          setErrors({ currentPassword: json.error ?? '현재 비밀번호가 올바르지 않습니다.' })
        } else {
          showToast(json.error ?? '비밀번호 변경에 실패했습니다.', 'error')
        }
        return
      }

      // 세션 JWT 업데이트 후 useEffect에서 isFirstLogin 변화 감지 시 이동
      await updateSession({ isFirstLogin: false })
      showToast('비밀번호가 변경되었습니다.', 'success')
      setWaitingRedirect(true)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3" aria-hidden="true">🔑</div>
          <h1 className="text-xl font-bold text-gray-900">비밀번호 변경</h1>
          <p className="text-sm text-gray-500 mt-2">
            최초 로그인 시 비밀번호를 변경해야 합니다.
          </p>
        </div>

        {/* 비밀번호 변경 카드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* 현재 비밀번호 */}
            <Input
              label="현재 비밀번호"
              type="password"
              placeholder="현재 비밀번호를 입력해주세요"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value)
                if (errors.currentPassword) setErrors((p) => ({ ...p, currentPassword: undefined }))
              }}
              error={errors.currentPassword}
              autoComplete="current-password"
              disabled={isLoading}
            />

            {/* 새 비밀번호 */}
            <Input
              label="새 비밀번호"
              type="password"
              placeholder="4자 이상의 새 비밀번호"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                if (errors.newPassword) setErrors((p) => ({ ...p, newPassword: undefined }))
              }}
              error={errors.newPassword}
              autoComplete="new-password"
              disabled={isLoading}
            />

            {/* 새 비밀번호 확인 */}
            <Input
              label="새 비밀번호 확인"
              type="password"
              placeholder="새 비밀번호를 한 번 더 입력"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined }))
              }}
              error={errors.confirmPassword}
              autoComplete="new-password"
              disabled={isLoading}
            />

            {/* 변경 버튼 */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              비밀번호 변경
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
