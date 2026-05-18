// src/app/api/auth/[...nextauth]/route.ts
// 목적: NextAuth.js App Router 라우트 핸들러 — GET/POST 요청을 NextAuth에 위임
// Next.js 14 App Router 방식: handler를 GET, POST로 named export

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// NextAuth 핸들러 생성 — authOptions에 정의된 설정 적용
const handler = NextAuth(authOptions)

// GET: 세션 조회, CSRF 토큰, 로그아웃 등
// POST: 로그인, 로그아웃 처리
export { handler as GET, handler as POST }
