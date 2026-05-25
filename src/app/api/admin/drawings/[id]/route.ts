// src/app/api/admin/drawings/[id]/route.ts
// 목적: 도면 삭제 API — 관리자 전용 (DELETE)
// - DB 레코드 삭제 + 물리 파일 삭제 (파일 없어도 DB 삭제 진행)

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

// DELETE: 도면 삭제 (관리자 전용)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ADMIN 세션 검증
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '관리자만 삭제할 수 있습니다.' }, { status: 403 })
  }

  const { id } = await params

  // DB에서 도면 조회 (파일 경로 확인용)
  const drawing = await prisma.drawing.findUnique({ where: { id } })
  if (!drawing) {
    return NextResponse.json({ success: false, error: '해당 도면을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 물리 파일 삭제 (파일 없어도 에러 무시 — DB 삭제는 항상 진행)
  const filePath = path.join(process.cwd(), 'uploads', 'drawings', drawing.filePath)
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (fileErr: unknown) {
    // 파일 삭제 실패는 로그만 남기고 DB 삭제는 계속 진행
    console.error('[도면 파일 삭제 실패]', fileErr)
  }

  // DB 레코드 삭제
  await prisma.drawing.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
