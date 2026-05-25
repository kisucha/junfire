// src/app/drawings/DrawingsNav.tsx
// 목적: 도면 게시판 네비게이션 헤더 — 역할별 메뉴 분기
'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

interface DrawingsNavProps {
  userName: string
  userRole: string
}

/**
 * 도면 게시판 공용 네비게이션 헤더
 * - 직원: 대시보드 / 도면 / 로그아웃
 * - 관리자: 관리자 대시보드 / 도면 관리 / 로그아웃
 */
export default function DrawingsNav({ userName, userRole }: DrawingsNavProps) {
  const router = useRouter()
  const isAdmin = userRole === 'ADMIN'

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* 로고 */}
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🔥</span>
            <span className="font-bold text-gray-800 hidden sm:inline">JunFire Protection</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
              도면
            </span>
          </div>

          {/* 네비게이션 버튼 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:inline">{userName}</span>

            {/* 역할별 대시보드 이동 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(isAdmin ? '/admin' : '/dashboard')}
            >
              {isAdmin ? '관리자 대시보드' : '대시보드'}
            </Button>

            {/* 관리자 전용: 도면 관리 페이지 */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin/drawings')}
              >
                도면 관리
              </Button>
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
      </div>
    </header>
  )
}
