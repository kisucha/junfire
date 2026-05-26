// src/app/api/drawings/[id]/route.ts
// 목적: 도면 단건 수정(PUT) · 삭제(DELETE)
// PUT: siteName / floor / type 수정 + 선택적 파일 교체 — 로그인 사용자 누구나 가능
// DELETE: 물리 파일 + DB 레코드 삭제 — 본인 등록 또는 ADMIN

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// 허용 도면 구분값
const VALID_TYPES = ['1st', '2nd', 'RCP', '기타'] as const

// 파일 저장 디렉토리 — process.cwd()=.next/standalone 기준
function getUploadsDir(): string {
  const dir = path.join(process.cwd(), 'uploads', 'drawings')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * PUT /api/drawings/[id]
 * multipart/form-data: siteName, floor, type (필수) + file (선택 — 파일 교체)
 * 권한: 로그인 사용자 누구나 수정 가능
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

  // multipart/form-data 파싱
  const formData = await req.formData()
  const siteName = formData.get('siteName')
  const floor = formData.get('floor')
  const type = formData.get('type')
  const file = formData.get('file')

  // 필수 필드 검증
  if (!siteName || typeof siteName !== 'string' || !siteName.trim()) {
    return NextResponse.json({ success: false, error: '현장명을 입력해주세요.' }, { status: 400 })
  }
  if (!floor || typeof floor !== 'string' || !floor.trim()) {
    return NextResponse.json({ success: false, error: '층을 입력해주세요.' }, { status: 400 })
  }

  // type 유효성 검증 — 잘못된 값이면 기존값 유지
  const validType = (typeof type === 'string' && VALID_TYPES.includes(type as typeof VALID_TYPES[number]))
    ? type
    : drawing.type

  // 파일 교체 처리 (file이 존재하고 크기 > 0인 경우만)
  let newFileName = drawing.fileName
  let newFilePath = drawing.filePath
  let newFileSize = drawing.fileSize

  if (file instanceof File && file.size > 0) {
    // PDF 형식 검증
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ success: false, error: 'PDF 파일만 업로드할 수 있습니다.' }, { status: 400 })
    }
    // 파일 크기 제한: 50MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '파일 크기는 50MB 이하여야 합니다.' }, { status: 400 })
    }

    // 기존 파일 삭제 (없어도 계속)
    try {
      const oldFilePath = path.join(getUploadsDir(), drawing.filePath)
      if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath)
    } catch (e) {
      console.warn('[기존 파일 삭제 실패 — 계속]', e)
    }

    // 새 파일 저장
    const bytes = await file.arrayBuffer()
    const savedFileName = `${randomUUID()}.pdf`
    fs.writeFileSync(path.join(getUploadsDir(), savedFileName), Buffer.from(bytes))

    newFileName = file.name
    newFilePath = savedFileName
    newFileSize = file.size
  }

  try {
    const updated = await prisma.drawing.update({
      where: { id },
      data: {
        siteName: siteName.trim(),
        floor: floor.trim(),
        type: validType,
        fileName: newFileName,
        filePath: newFilePath,
        fileSize: newFileSize,
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
