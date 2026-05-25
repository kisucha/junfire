// src/app/api/admin/report/daily/route.ts
// 목적: 날짜별×직원별 근무시간 크로스 테이블 API — 관리자 보고서 상세 표시용
// GET: startDate~endDate 범위 날짜별 전 직원 근무시간 반환

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // 인증 확인 — ADMIN만 허용
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeInactiveStr = searchParams.get('includeInactive')
    const includeInactive = includeInactiveStr === 'true'

    // 유효성 검증
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '시작일(startDate)과 종료일(endDate)을 모두 제공해주세요.' },
        { status: 400 }
      )
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: '시작일은 종료일보다 이전이어야 합니다.' },
        { status: 400 }
      )
    }

    // 1. 직원 목록 조회 — 가나다순 정렬
    const employees = await prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    // 2. 근무 기록 조회 — 기간 내
    const workRecords = await prisma.workRecord.findMany({
      where: {
        date: {
          gte: new Date(`${startDate}T00:00:00Z`),
          lte: new Date(`${endDate}T23:59:59Z`),
        },
        userId: { in: employees.map((e) => e.id) },
      },
      select: {
        id: true,
        userId: true,
        date: true,
        status: true,
        startTime: true,
        endTime: true,
        totalHours: true,
      },
    })

    // 3. 공휴일 조회 — 기간 내
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(`${startDate}T00:00:00Z`),
          lte: new Date(`${endDate}T23:59:59Z`),
        },
      },
      select: { date: true, name: true },
    })

    // 공휴일 Map 생성 (date string → name)
    const holidayMap = new Map(
      holidays.map((h) => [h.date.toISOString().slice(0, 10), h.name])
    )

    // 근무 기록 Map 생성 (userId → date string → record)
    const recordMap = new Map<string, Map<string, (typeof workRecords)[0]>>()
    workRecords.forEach((rec) => {
      const dateStr = rec.date.toISOString().slice(0, 10)
      if (!recordMap.has(rec.userId)) {
        recordMap.set(rec.userId, new Map())
      }
      recordMap.get(rec.userId)!.set(dateStr, rec)
    })

    // 4. 날짜 범위 순회 및 days 배열 생성
    const days = []
    const cur = new Date(`${startDate}T00:00:00Z`)
    const endDateObj = new Date(`${endDate}T23:59:59Z`)

    while (cur <= endDateObj) {
      const dateStr = cur.toISOString().slice(0, 10)
      const dayOfWeek = cur.getUTCDay()
      const isHoliday = holidayMap.has(dateStr)
      const holidayName = holidayMap.get(dateStr) || null

      // 각 직원별 근무시간 계산
      const records: Record<
        string,
        {
          hours: number
          status: string
        }
      > = {}

      employees.forEach((emp) => {
        const userRecords = recordMap.get(emp.id)
        const record = userRecords?.get(dateStr)

        if (record) {
          let hours = 0

          if (record.status === 'WORK') {
            // WORK: 실제 근무시간 (소수점 1자리 반올림)
            hours = record.totalHours ?? 0
            hours = Math.round(hours * 10) / 10
          } else if (record.status === 'SICK' || record.status === 'ANNUAL' || record.status === 'HOLIDAY') {
            // SICK/ANNUAL/HOLIDAY: 8시간 고정
            hours = 8
          } else if (record.status === 'UNPAID') {
            // UNPAID: 0시간 (기록 없음으로 처리)
            // 이 경우 해당 직원 entry 생성 안 함
            return
          }

          records[emp.id] = {
            hours,
            status: record.status,
          }
        }
      })

      days.push({
        date: dateStr,
        dayOfWeek,
        isHoliday,
        holidayName,
        records,
      })

      // 다음 날짜로 증가
      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          employees,
          days,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[API] /api/admin/report/daily 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
