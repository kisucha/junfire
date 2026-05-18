// src/app/api/admin/holidays/route.ts
// 목적: 공휴일 목록 조회(GET) + 공휴일 등록(POST) API (NF-V2-003)
// - GET: 전체 공휴일 또는 year+month 기준 월별 필터 조회
// - POST: YYYY-MM-DD 형식 검증 후 공휴일 등록, 날짜 중복 시 409 반환

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

// GET: 공휴일 목록 조회
// 쿼리 파라미터: year?, month? (둘 다 있으면 해당 월만, 없으면 전체 반환)
// GET /api/admin/holidays?year=2026&month=05
export async function GET(req: NextRequest) {
  // 세션 검증 + ADMIN 권한 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  // [NF-V2-003] year+month 쿼리 파라미터로 월별 필터 지원
  // Holiday.date는 @db.Date — 'yyyy-MM-dd'T00:00:00Z 형식으로 저장
  let dateFilter = {}
  if (year && month) {
    // 월 시작일 ~ 다음 달 시작일 미만 범위로 필터
    const gte = new Date(`${year}-${month.padStart(2, '0')}-01T00:00:00Z`)
    const nextMonth = new Date(gte)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    dateFilter = { date: { gte, lt: nextMonth } }
  }

  const holidays = await prisma.holiday.findMany({
    where: dateFilter,
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ success: true, data: holidays })
}

// POST: 공휴일 등록
// Body: { date: 'YYYY-MM-DD', name: string }
export async function POST(req: NextRequest) {
  // 세션 검증 + ADMIN 권한 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const { date, name } = await req.json()

  // 필수 필드 검증
  if (!date || !name) {
    return NextResponse.json(
      { error: '날짜와 공휴일명을 모두 입력해주세요.' },
      { status: 400 }
    )
  }

  // 날짜 형식 검증 (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    return NextResponse.json(
      { error: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // 날짜 유효성 추가 검증 — 실제 존재하는 날짜인지 확인
  const parsedDate = new Date(date)
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json(
      { error: '유효하지 않은 날짜입니다.' },
      { status: 400 }
    )
  }

  try {
    // [NF-V2-003] Holiday.date 저장 형식:
    // @db.Date 필드 — 'yyyy-MM-dd'T00:00:00Z 로 저장 (시각 정보 없음)
    // PostgreSQL date 타입으로 저장되므로 시각 변환 불필요
    const holiday = await prisma.holiday.create({
      data: {
        date: new Date(`${date}T00:00:00Z`),
        name,
        createdBy: session.user.id, // 등록 관리자 ID 기록
      },
    })

    return NextResponse.json({ success: true, data: holiday }, { status: 201 })
  } catch (error: unknown) {
    // [NF-V2-003] Holiday.date는 @unique — 같은 날짜 중복 등록 시 P2002 에러
    // [C-003] PrismaClientKnownRequestError + P2002 패턴으로 정확 감지
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: '해당 날짜에 이미 공휴일이 등록되어 있습니다.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: '공휴일 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
