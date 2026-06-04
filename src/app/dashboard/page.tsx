// src/app/dashboard/page.tsx
// 목적: 직원 랜딩 페이지 — 업무 기록 / 도면 게시판 선택 화면
'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

/**
 * 직원 랜딩 페이지
 * - 로그인 후 첫 화면
 * - "업무 기록" → /dashboard/work
 * - "도면 게시판" → /drawings
 */
export default function DashboardLandingPage() {
  const { data: session } = useSession()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 네비게이션 바 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🔥</span>
            <span className="font-bold text-gray-800">JunFire Protection</span>
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <span className="text-sm text-gray-600">{session.user.name}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 — 선택 카드 */}
      <main className="max-w-2xl mx-auto px-4 py-16">
        {/* 환영 메시지 */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-gray-800">
            안녕하세요, {session?.user.name ?? ''}님
          </h1>
          <p className="text-gray-500 mt-2">메뉴를 선택해주세요.</p>
        </div>

        {/* 선택 카드 3개 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* 업무 기록 카드 */}
          <button
            onClick={() => router.push('/dashboard/work')}
            className="group bg-white rounded-2xl shadow-sm border border-gray-200
              hover:border-blue-400 hover:shadow-md transition-all duration-150
              p-8 text-left"
          >
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-lg font-bold text-gray-800 group-hover:text-blue-700 mb-1">
              업무 기록
            </h2>
            <p className="text-sm text-gray-500">
              근무 시간 및 업무 내용을 기록합니다.
            </p>
          </button>

          {/* 업무내용 제공 카드 */}
          <button
            onClick={() => router.push('/dashboard/report')}
            className="group bg-white rounded-2xl shadow-sm border border-gray-200
              hover:border-green-400 hover:shadow-md transition-all duration-150
              p-8 text-left"
          >
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-lg font-bold text-gray-800 group-hover:text-green-700 mb-1">
              업무내용 제공
            </h2>
            <p className="text-sm text-gray-500">
              기간별 업무 내역 및 근무시간을 조회합니다.
            </p>
          </button>

          {/* 도면 게시판 카드 */}
          <button
            onClick={() => router.push('/drawings')}
            className="group bg-white rounded-2xl shadow-sm border border-gray-200
              hover:border-orange-400 hover:shadow-md transition-all duration-150
              p-8 text-left"
          >
            <div className="text-4xl mb-4">📐</div>
            <h2 className="text-lg font-bold text-gray-800 group-hover:text-orange-700 mb-1">
              도면 게시판
            </h2>
            <p className="text-sm text-gray-500">
              현장별 도면을 조회합니다.
            </p>
          </button>
        </div>
      </main>
    </div>
  )
}
