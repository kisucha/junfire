// src/next-auth.d.ts
// 목적: NextAuth Session/JWT 타입 확장 선언 — id, role, isFirstLogin 커스텀 필드 추가
// TypeScript strict 모드에서 session.user.role, session.user.id 접근 시 타입 오류 방지

import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  // Session.user 타입 확장 — 기본 name, email, image 외 커스텀 필드 추가
  interface Session {
    user: {
      id: string            // 사용자 고유 ID (CUID)
      username: string      // 로그인 아이디
      name: string          // 표시 이름
      role: string          // 'EMPLOYEE' | 'ADMIN' — Role 기반 접근 제어에 사용
      isFirstLogin: boolean // 최초 로그인 여부 — true면 비밀번호 변경 강제
    }
  }

  // authorize() 반환 User 타입 확장 — JWT 콜백에서 token에 복사됨
  interface User {
    id: string
    username: string
    role: string
    isFirstLogin: boolean
  }
}

declare module 'next-auth/jwt' {
  // JWT 토큰 타입 확장 — session 콜백에서 session.user로 복사됨
  interface JWT {
    id: string
    username: string
    role: string
    isFirstLogin: boolean
  }
}
