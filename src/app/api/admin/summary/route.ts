// src/app/api/admin/summary/route.ts
// 목적: 직원별 기간 집계 API — ADMIN 전용
// GET: startDate~endDate 범위 직원별 상태별 일수 + 총 근무시간 집계
// 집계 규칙: WORK=실제시간, SICK/ANNUAL/HOLIDAY=8시간 고정, UNPAID=0시간

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const includeInactive = searchParams.get('includeInactive') === 'true'

  if (!startDate || !endDate) {
    return NextResponse.json({ success: false, error: '날짜를 입력해주세요.' }, { status: 400 })
  }

  // 활성 직원 목록 조회 (EMPLOYEE만, ADMIN 제외)
  const users = await prisma.user.findMany({
    where: {
      role: 'EMPLOYEE',
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: { id: true, name: true, username: true },
    orderBy: { name: 'asc' },
  })

  if (users.length === 0) {
    return NextResponse.json({ success: true, data: [] })
  }

  // 기간 내 전체 기록을 userId+status 기준으로 그룹 집계
  // WorkRecord.date는 UTC Z 기준으로 저장되므로 Z 기준 필터 사용
  const grouped = await prisma.workRecord.groupBy({
    by: ['userId', 'status'],
    where: {
      date: {
        gte: new Date(`${startDate}T00:00:00Z`),
        lte: new Date(`${endDate}T23:59:59Z`),
      },
      userId: { in: users.map((u) => u.id) },
    },
    _count: { id: true },
    _sum: { totalHours: true },
  })

  // 직원별 집계 계산
  const data = users.map((user) => {
    const groups = grouped.filter((g) => g.userId === user.id)
    const get = (status: string) => groups.find((g) => g.status === status)

    const workDays     = get('WORK')?._count.id ?? 0
    const sickDays     = get('SICK')?._count.id ?? 0
    const annualDays   = get('ANNUAL')?._count.id ?? 0
    const holidayDays  = get('HOLIDAY')?._count.id ?? 0
    const unpaidDays   = get('UNPAID')?._count.id ?? 0
    const workActualHours = get('WORK')?._sum.totalHours ?? 0

    // SICK/ANNUAL/HOLIDAY는 하루 8시간 고정, UNPAID는 0시간
    const totalHours = (workActualHours ?? 0) + (sickDays + annualDays + holidayDays) * 8

    return {
      userId: user.id,
      name: user.name,
      username: user.username,
      workDays,
      sickDays,
      annualDays,
      holidayDays,
      unpaidDays,
      workActualHours: workActualHours ?? 0,
      totalHours,
    }
  })

  return NextResponse.json({ success: true, data })
}
