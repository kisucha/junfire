// src/app/admin/AdminNav.tsx
// 목적: 관리자 네비게이션 헤더 — 메뉴 링크 + 로그아웃 버튼
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Button from '@/components/ui/Button'

interface AdminNavProps {
  userName: string    // 로그인한 관리자 이름
}

// 관리자 네비게이션 메뉴 목록
const navItems = [
  { href: '/admin', label: '대시보드', exact: true },
  { href: '/admin/staff', label: '직원 관리', exact: false },
  { href: '/admin/report', label: '보고서', exact: false },
  { href: '/admin/drawings', label: '도면', exact: false },
]

/**
 * 관리자 네비게이션 컴포넌트 (Client Component)
 * - 현재 경로 강조 (active 상태)
 * - 로그아웃 버튼
 */
export default function AdminNav({ userName }: AdminNavProps) {
  const pathname = usePathname()

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* 로고 + 시스템명 */}
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🔥</span>
            <span className="font-bold text-gray-800 hidden sm:inline">JunFire Protection</span>
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
              관리자
            </span>
          </div>

          {/* 네비게이션 메뉴 */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              // exact 매칭: /admin은 정확히 일치, 나머지는 시작 일치
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* 사용자 정보 + 로그아웃 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:inline">{userName}</span>
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
