// src/lib/prisma.ts
// 목적: Prisma 클라이언트 싱글턴 — 개발 환경 핫리로드 시 다중 인스턴스 생성 방지
// Next.js 개발 서버는 파일 변경 시 모듈을 재로드하므로 globalThis에 인스턴스를 캐싱한다.

import { PrismaClient } from '@prisma/client'

// globalThis를 타입 확장하여 Prisma 인스턴스 저장 공간 확보
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// 이미 생성된 인스턴스가 있으면 재사용, 없으면 신규 생성
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // 개발 환경: 쿼리/에러/경고 전부 로깅 / 운영 환경: 에러만 로깅
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// 운영 환경이 아닐 때만 globalThis에 캐싱 (운영 환경에서는 서버 재시작이 없으므로 불필요)
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
