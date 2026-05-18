// src/app/api/holidays/route.ts
// 목적: 공휴일 공개 조회 API — 달력 렌더링용 (인증 불필요)
// 쿼리 파라미터: year, month (해당 월 공휴일 목록 반환)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fromZonedTime } from 'date-fns-tz'

// KST 타임존 상수
const TIMEZONE = 'Asia/Seoul'

/**
 * GET /api/holidays?year=2026&month=5
 * 인증 불필요 — 달력 렌더링 시 공개 공휴일 목록 조회용
 * 해당 월의 공휴일 목록 반환
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')

  // 파라미터 누락 시 에러
  if (!yearParam || !monthParam) {
    return NextResponse.json(
      { success: false, error: 'year와 month 파라미터가 필요합니다.' },
      { status: 400 }
    )
  }

  const year = parseInt(yearParam, 10)
  const month = parseInt(monthParam, 10)

  // 유효한 숫자인지 검증
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { success: false, error: '유효하지 않은 year 또는 month 값입니다.' },
      { status: 400 }
    )
  }

  // KST 기준 해당 월 범위 UTC 변환 — Prisma @db.Date 조건용
  const monthStr = String(month).padStart(2, '0')
  const kstStart = `${year}-${monthStr}-01T00:00:00`
  const gte = fromZonedTime(kstStart, TIMEZONE)

  // 다음 달 1일 계산
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthStr = String(nextMonth).padStart(2, '0')
  const kstEnd = `${nextYear}-${nextMonthStr}-01T00:00:00`
  const lt = fromZonedTime(kstEnd, TIMEZONE)

  try {
    const holidays = await prisma.holiday.findMany({
      where: {
        date: { gte, lt },
      },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        name: true,
        createdBy: true,
        createdAt: true,
      },
    })

    // date 필드를 YYYY-MM-DD 문자열로 변환
    const data = holidays.map((h) => ({
      ...h,
      date: h.date instanceof Date ? h.date.toISOString().slice(0, 10) : String(h.date),
      createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : String(h.createdAt),
    }))

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json(
      { success: false, error: '공휴일 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
