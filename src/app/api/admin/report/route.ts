// src/app/api/admin/report/route.ts
// 목적: 근무 기록 PDF 생성 및 다운로드 API (M-006)
// - POST: startDate~endDate 범위 WorkRecord + Holiday 조회 후 PDF 생성 → Buffer 반환
// - [C-004] generateReportFromDB 사용 — Prisma Date 객체를 DTO 문자열로 변환 후 PDF 생성
//          직접 generateReportPDF에 Prisma 결과를 전달하면 date 필드 타입 불일치 오류 발생
// [FIX-003] Node.js 런타임 명시 — @react-pdf/renderer는 fs 의존, Edge 런타임 불가
// [FIX-003] PDF 생성 타임아웃 60초 — 대용량 보고서 대비

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateReportFromDB } from '@/lib/pdf/generateReport'
import type { GenerateReportInput } from '@/types'

// POST: PDF 생성 및 다운로드
// Body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', includeInactive?: boolean }
export async function POST(req: NextRequest) {
  // 세션 검증 + ADMIN 권한 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const body: GenerateReportInput = await req.json()
  const { startDate, endDate, includeInactive = false } = body

  // 필수 파라미터 검증
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: '시작일과 종료일을 입력해주세요.' },
      { status: 400 }
    )
  }

  // 날짜 형식 검증 (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return NextResponse.json(
      { error: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // 날짜 순서 검증 — endDate가 startDate보다 이전이면 거부
  if (endDate < startDate) {
    return NextResponse.json(
      { error: '종료일이 시작일보다 이전일 수 없습니다.' },
      { status: 400 }
    )
  }

  try {
    // [M-006] generateReportFromDB 호출 — DB 조회 + DTO 변환 + PDF 생성 일괄 처리
    // Buffer → NextResponse로 바이너리 반환
    const pdfBuffer = await generateReportFromDB({ startDate, endDate, includeInactive })

    // [M-006] 파일명 패턴: junfire-report-{startDate}-{endDate}.pdf
    const filename = `junfire-report-${startDate}-${endDate}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    console.error('[PDF 생성 오류]', error)
    return NextResponse.json(
      { error: 'PDF 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
