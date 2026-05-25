// src/app/api/drawings/route.ts
// 목적: 도면 게시판 목록 조회 API — 인증된 사용자(직원·관리자) 모두 접근 가능
// GET: 전체 도면 목록 반환 (등록일 내림차순)

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    fileName: d.fileName,
    fileSize: d.fileSize,
    createdBy: d.createdBy,
    createdAt: d.createdAt.toISOString(),
  }))

  return NextResponse.json({ success: true, data })
}
