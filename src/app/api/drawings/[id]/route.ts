// src/app/api/drawings/[id]/route.ts
// 목적: 도면 단건 수정(PUT) · 삭제(DELETE) — 본인 등록 또는 ADMIN 권한
// PUT: siteName / floor / type 메타데이터만 수정 (파일 교체 불가)
// DELETE: 물리 파일 + DB 레코드 삭제

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

// 허용 도면 구분값
const VALID_TYPES = ['1st', '2nd', 'RCP', '기타'] as const

/**
 * PUT /api/drawings/[id]
 * 메타데이터 수정 — siteName, floor, type
 * 권한: 본인 등록 도면 또는 ADMIN
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params

  // 도면 존재 여부 확인
  const drawing = await prisma.drawing.findUnique({ where: { id } })
  if (!drawing) {
    return NextResponse.json({ success: false, error: '도면을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 권한 확인: 본인 또는 ADMIN
  if (session.user.role !== 'ADMIN' && drawing.createdBy !== session.user.id) {
    return NextResponse.json({ success: false, error: '수정 권한이 없습니다.' }, { status: 403 })
  }

  const body = await req.json() as { siteName?: string; floor?: string; type?: string }
  const { siteName, floor, type } = body

  // 필수 필드 검증
  if (!siteName?.trim()) {
    return NextResponse.json({ success: false, error: '현장명을 입력해주세요.' }, { status: 400 })
  }
  if (!floor?.trim()) {
    return NextResponse.json({ success: false, error: '층을 입력해주세요.' }, { status: 400 })
  }

  // type 유효성 검증 — 잘못된 값이면 기존값 유지
  const validType = VALID_TYPES.includes(type as typeof VALID_TYPES[number]) ? type! : drawing.type

  try {
    const updated = await prisma.drawing.update({
      where: { id },
      data: {
        siteName: siteName.trim(),
        floor: floor.trim(),
        type: validType,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        siteName: updated.siteName,
        floor: updated.floor,
        type: updated.type,
        fileName: updated.fileName,
        fileSize: updated.fileSize,
        createdBy: updated.createdBy,
        createdAt: updated.createdAt.toISOString(),
      },
    })
  } catch (error: unknown) {
    console.error('[도면 수정 오류]', error)
    return NextResponse.json({ success: false, error: '수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * DELETE /api/drawings/[id]
 * 권한: 본인이 등록한 도면 삭제 가능 (ADMIN은 모든 도면 삭제 가능)
 * 204: 삭제 성공 / 403: 권한 없음 / 404: 도면 없음
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params

  const drawing = await prisma.drawing.findUnique({ where: { id } })
  if (!drawing) {
    return NextResponse.json({ success: false, error: '도면을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (session.user.role !== 'ADMIN' && drawing.createdBy !== session.user.id) {
    return NextResponse.json(
      { success: false, error: '삭제 권한이 없습니다. 본인이 등록한 도면만 삭제할 수 있습니다.' },
      { status: 403 }
    )
  }

  // 물리 파일 삭제 (없어도 DB 삭제 계속)
  try {
    const filePath = path.join(process.cwd(), 'uploads', 'drawings', drawing.filePath)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (fileErr) {
    console.warn('[도면 파일 삭제 실패 — DB 삭제 계속]', fileErr)
  }

  await prisma.drawing.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
