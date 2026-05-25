// src/app/api/drawings/route.ts
// 목적: 도면 게시판 목록 조회(GET) 및 도면 업로드(POST) API
// GET: 인증된 모든 사용자 — 등록일 내림차순 목록 반환
// POST: 인증된 모든 사용자 — 직원·관리자 모두 도면 업로드 가능

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// 업로드 저장 디렉토리 — cwd 기준 (PM2 cwd=/opt/junfire 환경과 일치)
function getUploadsDir(): string {
  const dir = path.join(process.cwd(), 'uploads', 'drawings')
  // 디렉토리 없으면 자동 생성
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// GET: 도면 목록 조회 (인증 필수)
export async function GET(req: NextRequest) {
  // 인증 확인 (직원·관리자 모두 허용)
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 선택적 필터: 현장명 검색
  const { searchParams } = req.nextUrl
  const siteNameFilter = searchParams.get('siteName')

  const drawings = await prisma.drawing.findMany({
    where: siteNameFilter
      ? { siteName: { contains: siteNameFilter } }
      : {},
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      siteName: true,
      floor: true,
      fileName: true,
      fileSize: true,
      createdBy: true,
      createdAt: true,
    },
  })

  // DTO 변환 (createdAt → ISO 문자열)
  const data = drawings.map((d) => ({
    id: d.id,
    siteName: d.siteName,
    floor: d.floor,
    type: d.type,
    fileName: d.fileName,
    fileSize: d.fileSize,
    createdBy: d.createdBy,
    createdAt: d.createdAt.toISOString(),
  }))

  return NextResponse.json({ success: true, data })
}

/**
 * POST /api/drawings
 * 도면 업로드 — 인증된 모든 사용자 (직원·관리자) 가능
 * multipart/form-data: siteName(현장명), floor(층), file(PDF, 최대 50MB)
 */
export async function POST(req: NextRequest) {
  // 인증 확인 (역할 무관 — 직원·관리자 모두 허용)
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
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

    // 파일 내용 읽기 → 디스크 저장
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // UUID 기반 저장 파일명 (원본 파일명과 분리하여 경로 충돌 방지)
    const savedFileName = `${randomUUID()}.pdf`
    const uploadsDir = getUploadsDir()
    const filePath = path.join(uploadsDir, savedFileName)
    fs.writeFileSync(filePath, buffer)

    // type 필드: 1st / 2nd / RCP 유효성 검증 (기본값: 1st)
    const typeRaw = formData.get('type')
    const VALID_TYPES = ['1st', '2nd', 'RCP']
    const drawingType = (typeof typeRaw === 'string' && VALID_TYPES.includes(typeRaw)) ? typeRaw : '1st'

    // DB 메타데이터 저장
    const drawing = await prisma.drawing.create({
      data: {
        siteName: siteName.trim(),
        floor: floor.trim(),
        type: drawingType,
        fileName: file.name,        // 원본 파일명 (표시용)
        filePath: savedFileName,    // 저장 파일명 (UUID 기반)
        fileSize: file.size,
        createdBy: session.user.id, // 등록자 ID (삭제 권한 확인용)
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: drawing.id,
        siteName: drawing.siteName,
        floor: drawing.floor,
        type: drawing.type,
        fileName: drawing.fileName,
        fileSize: drawing.fileSize,
        createdBy: drawing.createdBy,
        createdAt: drawing.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error: unknown) {
    console.error('[도면 업로드 오류]', error)
    return NextResponse.json(
      { success: false, error: '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
