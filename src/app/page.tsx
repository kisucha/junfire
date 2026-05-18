// src/app/page.tsx
// 목적: 랜딩 페이지 — 로그인 상태에 따라 역할별 자동 리다이렉트
// [NF-V2-001] middleware.ts matcher에서 '/' 제외 — 클라이언트사이드 리다이렉트 처리
'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

/**
 * 랜딩 페이지 컴포넌트
 * - 로그인 상태 감지: 로그인된 ADMIN → /admin, EMPLOYEE → /dashboard
 * - 비로그인: JunFire Protection 소개 + 로그인 버튼 표시
 */
export default function LandingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 로그인 상태 변경 시 역할별 리다이렉트
  useEffect(() => {
    if (status === 'authenticated' && session) {
      if (session.user.role === 'ADMIN') {
        router.replace('/admin')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [session, status, router])

  // 세션 로딩 중
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // 이미 로그인된 상태 — 리다이렉트 대기 중 (깜빡임 방지)
  if (status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // 비로그인 상태 — 랜딩 페이지 표시
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 px-4">
      {/* 로고 + 회사명 영역 */}
      <div className="text-center mb-10">
        {/* 불꽃 아이콘 — 회사 이미지 */}
        <div className="text-6xl mb-4" aria-hidden="true">🔥</div>

        {/* 회사명 */}
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          JunFire Protection
        </h1>

        {/* 영문 부제목 */}
        <p className="text-slate-400 text-lg font-medium mb-1">
          업무시간 관리 시스템
        </p>

        {/* 설명 문구 */}
        <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed mt-3">
          직원 업무 기록, 근무 시간 집계, 보고서 생성까지<br />
          체계적으로 관리하는 스마트 업무 관리 솔루션입니다.
        </p>
      </div>

      {/* 로그인 버튼 */}
      <div className="w-full max-w-xs">
        <Button
          variant="primary"
          size="lg"
          onClick={() => router.push('/login')}
          className="w-full bg-orange-500 hover:bg-orange-600 border-0 focus:ring-orange-400 text-base font-semibold shadow-lg"
        >
          로그인
        </Button>
      </div>

      {/* 저작권 */}
      <p className="text-slate-600 text-xs mt-12">
        &copy; {new Date().getFullYear()} JunFire Protection. All rights reserved.
      </p>
    </div>
  )
}
