// src/app/drawings/layout.tsx
// 목적: 도면 게시판 레이아웃 — 인증 확인 + 공용 헤더 (직원·관리자 모두 접근)

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import DrawingsNav from './DrawingsNav'

interface DrawingsLayoutProps {
  children: React.ReactNode
}

/**
 * 도면 게시판 레이아웃 (Server Component)
 * - 세션 없으면 /login 리다이렉트
 * - 직원: /drawings 열람 가능
 * - 관리자: /drawings 열람 + /admin/drawings 관리 가능
 */
export default async function DrawingsLayout({ children }: DrawingsLayoutProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 도면 게시판 공용 헤더 */}
      <DrawingsNav
        userName={session.user.name}
        userRole={session.user.role}
      />

      {/* 페이지 콘텐츠 */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
