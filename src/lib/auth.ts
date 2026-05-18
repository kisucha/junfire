// src/lib/auth.ts
// 목적: NextAuth.js 인증 설정 — Credentials Provider, JWT 세션, Role/isFirstLogin 콜백 처리
// isActive 비활성 계정 차단, isFirstLogin 최초 로그인 플래그 JWT 포함

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  // JWT 전략 사용 — DB 세션 대비 매 요청 DB 조회 없음 (소규모 5명 환경에 최적)
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8시간 — 업무 시간 동안 세션 만료 없도록 설정
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: '아이디', type: 'text' },
        password: { label: '비밀번호', type: 'password' },
      },
      // 로그인 인증 로직 — 아이디 조회 → isActive 확인 → 비밀번호 검증 순서
      async authorize(credentials) {
        // 아이디 또는 비밀번호 미입력 시 인증 실패
        if (!credentials?.username || !credentials.password) return null

        // 아이디로 사용자 조회
        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        })

        // 사용자 미존재 시 인증 실패
        if (!user) return null

        // 비활성 계정 로그인 차단 — ADMIN은 비활성화 여부와 관계없이 항상 로그인 가능
        if (!user.isActive && user.role !== 'ADMIN') {
          throw new Error('INACTIVE_ACCOUNT')
        }

        // bcrypt 비밀번호 검증 (cost factor 12로 해싱된 값과 비교)
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) return null

        // 인증 성공 시 User 객체 반환 — JWT 콜백에서 토큰에 추가됨
        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          isFirstLogin: user.isFirstLogin,
        }
      },
    }),
  ],
  callbacks: {
    // JWT 토큰에 커스텀 필드 추가 — user 객체는 최초 로그인 시에만 존재
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // 최초 로그인 시 user 객체에서 커스텀 필드를 토큰에 저장
        token.id = user.id
        token.username = user.username
        token.role = user.role
        token.isFirstLogin = user.isFirstLogin
      }
      // updateSession() 호출 시 (trigger === 'update') 토큰의 isFirstLogin 업데이트
      if (trigger === 'update' && session?.isFirstLogin !== undefined) {
        token.isFirstLogin = session.isFirstLogin
      }
      return token
    },
    // 세션 객체에 커스텀 필드 노출 — 클라이언트/서버 컴포넌트에서 접근 가능
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.username = token.username as string
      session.user.role = token.role as string
      session.user.isFirstLogin = token.isFirstLogin as boolean
      return session
    },
  },
  pages: {
    // 커스텀 로그인/에러 페이지 경로 지정
    signIn: '/login',
    error: '/login',
  },
}
