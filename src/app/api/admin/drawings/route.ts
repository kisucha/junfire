// src/app/api/admin/drawings/route.ts
// 목적: 도면 게시판 — 관리자 전용 업로드(POST) API
// - 인증: ADMIN 세션 필수
// - multipart/form-data: siteName(현장명), floor(층), file(PDF)
// - 저장 위치: {cwd}/uploads/drawings/{cuid}.pdf

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// 업로드 저장 디렉토리 — cwd 기준 (PM2 cwd=/opt/junfire과 일치)
function getUploadsDir(): string {
  const dir = path.join(process.cwd(), 'uploads', 'drawings')
  // 디렉토리 없으면 자동 생성
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// POST: 도면 업로드 (관리자 전용)
export async function POST(req: NextRequest) {
  // ADMIN 세션 검증
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '관리자만 업로드할 수 있습니다.' }, { status: 403 })
  }

  try {
    // multipart/form-data 파싱
    const formData = await req.formData()
    const siteName = formData.get('siteName')
    const floor = formData.get('floor')
    const file = formData.get('file')

    // 필수 필드 검증
    if (!siteName || typeof siteName !== 'string' || siteName.trim() === '') {
      return NextResponse.json({ success: false, error: '현장명을 입력해주세요.' }, { status: 400 })
    }
    if (!floor || typeof floor !== 'string' || floor.trim() === '') {
      return NextResponse.json({ success: false, error: '층을 입력해주세요.' }, { status: 400 })
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'PDF 파일을 선택해주세요.' }, { status: 400 })
    }

    // PDF 파일 형식 검증
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ success: false, error: 'PDF 파일만 업로드할 수 있습니다.' }, { status: 400 })
    }

    // 파일 크기 제한: 50MB
    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: '파일 크기는 50MB 이하여야 합니다.' }, { status: 400 })
    }

    // 파일 내용 읽기
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 저장 파일명: UUID + .pdf (원본 파일명과 분리하여 충돌 방지)
    const savedFileName = `${randomUUID()}.pdf`
    const uploadsDir = getUploadsDir()
    const filePath = path.join(uploadsDir, savedFileName)

    // 파일 디스크 저장
    fs.writeFileSync(filePath, buffer)

    // DB 메타데이터 저장
    const drawing = await prisma.drawing.create({
      data: {
        siteName: siteName.trim(),
        floor: floor.trim(),
        fileName: file.name,
        filePath: savedFileName,
        fileSize: file.size,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: drawing.id,
        siteName: drawing.siteName,
        floor: drawing.floor,
        fileName: drawing.fileName,
        fileSize: drawing.fileSize,
        createdBy: drawing.createdBy,
        createdAt: drawing.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error: unknown) {
    console.error('[도면 업로드 오류]', error)
    return NextResponse.json({ success: false, error: '업로드 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
