// src/app/api/locations/route.ts
// 목적: 활성 업무 현장 목록 조회 — 직원 기록 폼의 체크박스 데이터 제공

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: 활성 현장만 반환 (isActive=true)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const locations = await prisma.workLocation.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  })

  return NextResponse.json({ success: true, data: locations })
}
