// src/app/api/drawings/[id]/file/route.ts
// 목적: 도면 PDF 파일 스트리밍 API — 인증된 사용자(직원·관리자) 접근 가능
// GET: DB에서 파일 경로 조회 후 PDF 바이너리 반환

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

// GET: PDF 파일 스트리밍 (인증 필수)
// 쿼리 파라미터: ?download=true → Content-Disposition: attachment (강제 다운로드)
//               (기본값)         → Content-Disposition: inline  (브라우저 뷰어)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 인증 확인 (직원·관리자 모두 허용)
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params

  // ?download=true 쿼리 파라미터 확인 — 모바일 다운로드 지원
  const isDownload = req.nextUrl.searchParams.get('download') === 'true'

  // DB에서 도면 메타데이터 조회
  const drawing = await prisma.drawing.findUnique({
    where: { id },
    select: { fileName: true, filePath: true },
  })

  if (!drawing) {
    return NextResponse.json({ success: false, error: '해당 도면을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 물리 파일 경로 확인
  const filePath = path.join(process.cwd(), 'uploads', 'drawings', drawing.filePath)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ success: false, error: '파일이 존재하지 않습니다.' }, { status: 404 })
  }

  // 파일 읽기 + 응답 반환
  const fileBuffer = fs.readFileSync(filePath)

  // 원본 파일명 URL 인코딩 (한글 파일명 대응)
  const encodedFileName = encodeURIComponent(drawing.fileName)

  // isDownload=true → attachment(강제 다운로드), false → inline(브라우저 뷰어)
  const disposition = isDownload
    ? `attachment; filename*=UTF-8''${encodedFileName}`
    : `inline; filename*=UTF-8''${encodedFileName}`

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Content-Length': fileBuffer.length.toString(),
      // 캐시 설정: 1시간 브라우저 캐시 (도면은 자주 바뀌지 않음)
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
