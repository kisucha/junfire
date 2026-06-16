// src/middleware.ts
// 목적: 라우트 보호 — 미인증 접근 차단 + isFirstLogin=true 시 /change-password 강제 이동

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // isFirstLogin=true 이고 비밀번호 변경 페이지가 아니면 강제 이동
    if (token?.isFirstLogin && pathname !== '/change-password') {
      return NextResponse.redirect(new URL('/change-password', req.url))
    }
  },
  {
    callbacks: {
      // JWT 토큰 존재 여부로 인증 확인 — 없으면 /login 자동 리다이렉트
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  // 보호 대상 경로 — API, _next 정적 파일, 로그인 페이지 제외
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/change-password',
  ],
}
