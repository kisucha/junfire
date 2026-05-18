// src/middleware.ts
// 목적: NextAuth 미들웨어 기반 경로별 접근 제어 — Role 분기, isFirstLogin 강제 이동
// [NF-V2-001] matcher에서 '/' 제거 — 랜딩 페이지는 비로그인 사용자도 공개 접근 가능

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  // withAuth 내부 미들웨어 — authorized 콜백 통과 후(토큰 있음) 실행
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // ADMIN이 /dashboard 또는 /record/* 접근 시 /admin으로 리다이렉트
    // 관리자 전용 경로와 직원 경로를 명확히 분리
    if (
      token?.role === 'ADMIN' &&
      (pathname.startsWith('/dashboard') || pathname.startsWith('/record'))
    ) {
      return NextResponse.redirect(new URL('/admin', req.url))
    }

    // EMPLOYEE가 /admin/* 접근 시 /dashboard로 리다이렉트
    // 직원이 관리자 페이지에 URL 직접 입력하는 경우 차단
    if (token?.role === 'EMPLOYEE' && pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // 최초 로그인 강제 비밀번호 변경: /change-password 이외 모든 경로 차단
    // isFirstLogin=true인 사용자가 /change-password를 제외한 모든 경로 접근 시 강제 이동
    if (token?.isFirstLogin === true && pathname !== '/change-password') {
      return NextResponse.redirect(new URL('/change-password', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // 토큰 없으면 /login 으로 자동 리다이렉트 (withAuth 기본 동작)
      authorized: ({ token }) => !!token,
    },
  }
)

// [NF-V2-001] matcher에서 '/' 제거
// '/'를 포함하면 authorized: ({token}) => !!token 에 의해
// 비로그인 사용자가 랜딩 페이지 대신 /login으로 강제 리다이렉트됨 (RESEARCH.md 6.1 위반)
// 로그인 상태 감지 및 역할별 리다이렉트는 app/page.tsx에서 클라이언트사이드 useSession()으로 처리
export const config = {
  matcher: [
    '/dashboard/:path*', // 직원 대시보드 전체 경로
    '/admin/:path*',     // 관리자 페이지 전체 경로
    '/record/:path*',    // 업무 기록 경로 (직접 접근 방어)
    '/change-password',  // 비밀번호 변경 페이지
  ],
}
