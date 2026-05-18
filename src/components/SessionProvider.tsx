// src/components/SessionProvider.tsx
// 목적: NextAuth 세션 컨텍스트 제공자 — 루트 레이아웃에서 사용
'use client'

import { SessionProvider } from 'next-auth/react'

interface ProviderProps {
  children: React.ReactNode
}

/**
 * NextAuth SessionProvider 래퍼 컴포넌트
 * - 'use client' 선언 필요 — 루트 레이아웃에서 Server Component 경계 분리용
 * - 앱 전체에서 useSession() 훅 사용 가능하게 함
 */
export default function Provider({ children }: ProviderProps) {
  return <SessionProvider>{children}</SessionProvider>
}
