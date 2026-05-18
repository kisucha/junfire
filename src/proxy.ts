// src/proxy.ts
// 목적: NextAuth 미들웨어 기반 경로별 접근 제어 — Role 분기, isFirstLogin 강제 이동
// [NF-V2-001] matcher에서 '/' 제거 — 랜딩 페이지는 비로그인 사용자도 공개 접근 가능
// Next.js 16: middleware.ts → proxy.ts 파일명 변경

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // ADMIN이 /dashboard 또는 /record/* 접근 시 /admin으로 리다이렉트
    if (
      token?.role === 'ADMIN' &&
      (pathname.startsWith('/dashboard') || pathname.startsWith('/record'))
    ) {
      return NextResponse.redirect(new URL('/admin', req.url))
    }

    // EMPLOYEE가 /admin/* 접근 시 /dashboard로 리다이렉트
    if (token?.role === 'EMPLOYEE' && pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // 최초 로그인 강제 비밀번호 변경: /change-password 이외 모든 경로 차단
    if (token?.isFirstLogin === true && pathname !== '/change-password') {
      return NextResponse.redirect(new URL('/change-password', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/record/:path*',
    '/change-password',
  ],
}
