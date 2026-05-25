// src/app/api/worklocation/route.ts
// 목적: 활성 업무 현장(WorkLocation) 목록 조회 API — 도면 등록 시 현장명 드롭다운용
// 인증된 사용자(직원·관리자) 모두 접근 가능

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/worklocation
 * 활성(isActive=true) 현장 목록을 이름 오름차순으로 반환
 * 도면 등록 폼의 현장명 드롭다운에서 사용
 */
export async function GET() {
  // 인증 확인 (직원·관리자 모두 허용)
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }

  try {
    // 활성 현장만 이름 오름차순 조회
    const locations = await prisma.workLocation.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
      },
    })

    return NextResponse.json({ success: true, data: locations })
  } catch (error: unknown) {
    console.error('[현장 목록 조회 오류]', error)
    return NextResponse.json(
      { success: false, error: '현장 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
