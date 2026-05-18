// src/app/api/admin/holidays/[id]/route.ts
// 목적: 공휴일 삭제(DELETE) API (NF-V2-003)
// - DELETE: 존재 확인 후 삭제, 미존재 시 404, 성공 시 204 No Content

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE: 공휴일 삭제
// 성공 시 204 No Content 반환
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 세션 검증 + ADMIN 권한 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await params

  // 존재 확인 — 미존재 시 404 반환
  const holiday = await prisma.holiday.findUnique({ where: { id } })
  if (!holiday) {
    return NextResponse.json(
      { error: '해당 공휴일을 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  // 공휴일 삭제
  await prisma.holiday.delete({ where: { id } })

  // [NF-V2-003] 삭제 성공 시 204 No Content 반환
  return new NextResponse(null, { status: 204 })
}
