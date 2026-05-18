// src/app/admin/layout.tsx
// 목적: 관리자 레이아웃 — ADMIN 세션 확인 + 관리자 네비게이션 메뉴
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import AdminNav from './AdminNav'

interface AdminLayoutProps {
  children: React.ReactNode
}

/**
 * 관리자 레이아웃 (Server Component)
 * - 서버에서 세션 확인 — ADMIN role이 아니면 /dashboard 리다이렉트
 * - 관리자 네비게이션 포함
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getServerSession(authOptions)

  // 로그인 상태가 아니거나 ADMIN이 아니면 리다이렉트
  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 관리자 공통 헤더 */}
      <AdminNav userName={session.user.name} />

      {/* 페이지 콘텐츠 */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
