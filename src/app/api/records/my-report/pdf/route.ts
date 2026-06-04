// src/app/api/records/my-report/pdf/route.ts
// 목적: 직원 본인 기간 업무 기록 PDF 다운로드 API
// GET /api/records/my-report/pdf?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// @react-pdf/renderer는 fs 의존 — Node.js 런타임 필수

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isValidDateStr } from '@/lib/utils/date'
import { generateEmployeeReportPDF } from '@/lib/pdf/generateEmployeeReport'
import type { WorkRecordDTO, RecordStatus } from '@/types'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }

  const { searchParams } = req.nextUrl
  const startDate = searchParams.get('startDate')
  const endDate   = searchParams.get('endDate')

  if (
    !startDate || !endDate ||
    !isValidDateStr(startDate) || !isValidDateStr(endDate)
  ) {
    return NextResponse.json(
      { success: false, error: '날짜 형식이 올바르지 않습니다.' },
      { status: 400 }
    )
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { success: false, error: '시작일은 종료일보다 이전이어야 합니다.' },
      { status: 400 }
    )
  }

  // 직원 이름 조회
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  })

  // 본인 기록 날짜 오름차순 조회
  const rawRecords = await prisma.workRecord.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: new Date(`${startDate}T00:00:00Z`),
        lte: new Date(`${endDate}T23:59:59Z`),
      },
    },
    orderBy: { date: 'asc' },
  })

  // 총 근무시간 집계 (my-report route와 동일 규칙)
  let totalHoursSum = 0
  for (const r of rawRecords) {
    if (r.status === 'WORK') {
      totalHoursSum += r.totalHours ?? 0
    } else if (r.status === 'SICK' || r.status === 'ANNUAL' || r.status === 'HOLIDAY') {
      totalHoursSum += 8
    }
  }
  totalHoursSum = Math.round(totalHoursSum * 100) / 100

  // Prisma 결과를 WorkRecordDTO로 변환
  const records: WorkRecordDTO[] = rawRecords.map(r => ({
    id:          r.id,
    userId:      r.userId,
    date:        r.date.toISOString(),
    status:      r.status as RecordStatus,
    startTime:   r.startTime?.toISOString() ?? null,
    endTime:     r.endTime?.toISOString() ?? null,
    totalHours:  r.totalHours,
    location:    r.location,
    description: r.description,
    createdBy:   r.createdBy,
    updatedBy:   r.updatedBy ?? null,
    createdAt:   r.createdAt.toISOString(),
    updatedAt:   r.updatedAt.toISOString(),
  }))

  // PDF 생성
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generateEmployeeReportPDF({
      employeeName: user?.name ?? session.user.name ?? '직원',
      startDate,
      endDate,
      records,
      totalHoursSum,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[직원 PDF 생성 오류]', errMsg)
    return NextResponse.json(
      { success: false, error: `PDF 생성 중 오류가 발생했습니다. (${errMsg})` },
      { status: 500 }
    )
  }

  const employeeName = user?.name ?? 'unknown'
  const fileName = `JunFire_업무기록_${employeeName}_${startDate}_${endDate}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      // RFC 5987 인코딩 — 한글 파일명 브라우저 호환
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  })
}
