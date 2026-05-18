// src/app/login/page.tsx
// 목적: 로그인 페이지 — 이메일/비밀번호 폼 + NextAuth credentials signIn
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

/**
 * 로그인 페이지 컴포넌트
 * - 이메일 + 비밀번호 입력 폼
 * - signIn('credentials') 호출
 * - INACTIVE_ACCOUNT 에러: 비활성화 계정 안내
 * - 일반 실패: 이메일/비밀번호 오류 안내
 * - isFirstLogin: /change-password 리다이렉트 (middleware 처리 + 클라이언트 폴백)
 */
export default function LoginPage() {
  const router = useRouter()

  // 폼 입력값 상태
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // 폼 에러 메시지 상태
  const [errors, setErrors] = useState<{ username?: string; password?: string; general?: string }>({})

  // 로그인 진행 중 여부
  const [isLoading, setIsLoading] = useState(false)

  // 유효성 검증
  function validate(): boolean {
    const newErrors: typeof errors = {}
    if (!username.trim()) newErrors.username = '아이디를 입력해주세요.'
    if (!password) newErrors.password = '비밀번호를 입력해주세요.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 로그인 처리
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setErrors({})

    try {
      const result = await signIn('credentials', {
        username: username.trim(),
        password,
        redirect: false,  // 수동 리다이렉트 처리
      })

      if (!result || result.error) {
        // 에러 코드에 따른 한국어 메시지 표시
        if (result?.error === 'INACTIVE_ACCOUNT') {
          setErrors({ general: '비활성화된 계정입니다. 관리자에게 문의하세요.' })
        } else {
          setErrors({ general: '이메일 또는 비밀번호가 올바르지 않습니다.' })
        }
        return
      }

      // 로그인 성공 — middleware가 최초 로그인 체크 후 리다이렉트
      // 클라이언트 폴백: role에 따라 이동
      router.push('/')  // 랜딩 페이지가 세션 확인 후 역할별 리다이렉트
    } catch {
      setErrors({ general: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* 로고/제목 */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3" aria-hidden="true">🔥</div>
          <h1 className="text-2xl font-bold text-gray-900">JunFire Protection</h1>
          <p className="text-sm text-gray-500 mt-1">업무 관리 시스템 로그인</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleLogin} noValidate className="space-y-4">
            {/* 아이디 */}
            <Input
              label="아이디"
              type="text"
              placeholder="아이디를 입력해주세요"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (errors.username) setErrors((p) => ({ ...p, username: undefined }))
              }}
              error={errors.username}
              autoComplete="username"
              disabled={isLoading}
            />

            {/* 비밀번호 */}
            <Input
              label="비밀번호"
              type="password"
              placeholder="비밀번호를 입력해주세요"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errors.password) setErrors((p) => ({ ...p, password: undefined }))
              }}
              error={errors.password}
              autoComplete="current-password"
              disabled={isLoading}
            />

            {/* 전반적인 에러 메시지 */}
            {errors.general && (
              <div
                role="alert"
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"
              >
                {errors.general}
              </div>
            )}

            {/* 로그인 버튼 */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              로그인
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
