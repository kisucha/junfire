// src/app/api/drawings/[id]/route.ts
// 목적: 도면 단건 삭제 API — 본인 등록 도면 또는 ADMIN 전체 삭제 가능
// 물리 파일 삭제 후 DB 레코드 삭제 (파일 없어도 DB 삭제 진행)

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

/**
 * DELETE /api/drawings/[id]
 * 권한: 본인이 등록한 도면 삭제 가능 (ADMIN은 모든 도면 삭제 가능)
 * 204: 삭제 성공 / 403: 권한 없음 / 404: 도면 없음
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 인증 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }

  const { id } = await params

  // 도면 존재 여부 확인
  const drawing = await prisma.drawing.findUnique({ where: { id } })
  if (!drawing) {
    return NextResponse.json(
      { success: false, error: '도면을 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  // 권한 확인: 본인 등록 도면 또는 ADMIN만 삭제 가능
  if (session.user.role !== 'ADMIN' && drawing.createdBy !== session.user.id) {
    return NextResponse.json(
      { success: false, error: '삭제 권한이 없습니다. 본인이 등록한 도면만 삭제할 수 있습니다.' },
      { status: 403 }
    )
  }

  // 물리 파일 삭제 (없어도 DB 삭제는 계속 진행)
  try {
    const filePath = path.join(process.cwd(), 'uploads', 'drawings', drawing.filePath)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (fileErr) {
    // 파일 삭제 실패는 무시하고 DB 삭제 진행
    console.warn('[도면 파일 삭제 실패 — DB 삭제 계속]', fileErr)
  }

  // DB 레코드 삭제
  await prisma.drawing.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
