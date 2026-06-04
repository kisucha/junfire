// src/app/api/records/my-report/route.ts
// 목적: 직원 본인 기간 업무 기록 조회 API — 날짜 오름차순 + 총 근무시간 합계
// 집계 규칙: WORK=실제시간, SICK/ANNUAL/HOLIDAY=8시간 고정, UNPAID=0시간

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isValidDateStr } from '@/lib/utils/date'

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
  const endDate = searchParams.get('endDate')

  if (!startDate || !endDate || !isValidDateStr(startDate) || !isValidDateStr(endDate)) {
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

  // 본인 기록만 날짜 오름차순 조회
  const records = await prisma.workRecord.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: new Date(`${startDate}T00:00:00Z`),
        lte: new Date(`${endDate}T23:59:59Z`),
      },
    },
    orderBy: { date: 'asc' },
  })

  // 총 근무시간 집계
  let totalHoursSum = 0
  for (const r of records) {
    if (r.status === 'WORK') {
      totalHoursSum += r.totalHours ?? 0
    } else if (r.status === 'SICK' || r.status === 'ANNUAL' || r.status === 'HOLIDAY') {
      totalHoursSum += 8
    }
    // UNPAID: 0시간 (제외)
  }
  totalHoursSum = Math.round(totalHoursSum * 100) / 100

  return NextResponse.json({ success: true, data: records, totalHoursSum })
}
