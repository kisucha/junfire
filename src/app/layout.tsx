// src/app/layout.tsx
// 목적: 루트 레이아웃 — 전역 CSS, 세션 Provider, Toast Provider 설정
import type { Metadata } from 'next'
import './globals.css'
import SessionProviderWrapper from '@/components/SessionProvider'
import ToastProvider from '@/components/ui/Toast'

// Next.js 메타데이터 — 브라우저 탭 제목 및 설명
export const metadata: Metadata = {
  title: 'JunFire Protection — 업무 관리',
  description: 'JunFire Protection 직원 업무시간 관리 시스템',
}

interface RootLayoutProps {
  children: React.ReactNode
}

/**
 * 루트 레이아웃 컴포넌트
 * - SessionProvider: 앱 전체 NextAuth 세션 공유
 * - ToastProvider: 앱 전체 토스트 알림 시스템
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <head>
        {/* 한국어 Noto Sans KR 폰트 — Google Fonts CDN */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased" suppressHydrationWarning>
        <SessionProviderWrapper>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
