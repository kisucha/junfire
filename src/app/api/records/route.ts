// src/app/api/records/route.ts
// 목적: 직원 본인 업무 기록 목록 조회(GET) + 생성(POST) API Route
// - GET: cursor 기반 페이징, yearMonth 월 필터 지원
// - POST: 유효성 검증 후 기록 생성 (WORK 상태 필수값, 미래 날짜 차단, totalHours 서버 계산)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { buildCursorQuery, buildCursorResult } from '@/lib/utils/pagination'
import { isValidDateStr, getTodayKST, getMonthRangeUTC } from '@/lib/utils/date'
import { calcTotalHours, toUTCDateTime } from '@/lib/utils/time'
import type { CreateRecordInput } from '@/types'

// GET: 직원 본인 기록 목록 조회 — cursor 기반 페이징
// 쿼리 파라미터: cursor?, take?(기본 20), yearMonth?(YYYY-MM)
export async function GET(req: NextRequest) {
  // 인증 확인 — 미인증 시 401 반환
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }

  const { searchParams } = req.nextUrl

  // cursor: 이전 페이지 마지막 레코드 id (없으면 첫 페이지부터 조회)
  const cursor = searchParams.get('cursor') ?? undefined

  // take: 가져올 건수, 기본 20, 최대 100으로 제한
  const take = Math.min(Number(searchParams.get('take') ?? 20), 100)

  // yearMonth: "YYYY-MM" 형식 — 달력 월별 로딩에 사용 (없으면 전체 조회)
  const yearMonth = searchParams.get('yearMonth')

  // [C-002] yearMonth 월 범위 계산 — getMonthRangeUTC 유틸로 KST 기준 UTC 변환
  const monthFilter = yearMonth ? getMonthRangeUTC(yearMonth) : null

  // cursor 기반 페이징 쿼리 옵션 생성
  const cursorQuery = buildCursorQuery({ cursor, take })

  // 직원 본인 기록만 조회 — userId를 세션 id로 고정하여 URL 조작 방어
  const records = await prisma.workRecord.findMany({
    where: {
      userId: session.user.id,
      ...(monthFilter ? { date: monthFilter } : {}),
    },
    orderBy: { date: 'desc' },
    take: cursorQuery.take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })

  // cursor 페이징 결과 변환 후 응답
  const result = buildCursorResult(records, take)
  return NextResponse.json({ success: true, ...result })
}

// POST: 업무 기록 생성
// EMPLOYEE 또는 ADMIN 모두 허용 — 세션 userId 기준으로 본인 기록으로 생성
export async function POST(req: NextRequest) {
  // 인증 확인 — 미인증 시 401 반환
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }

  const body: CreateRecordInput = await req.json()
  const { date, status, startTime, endTime, location, description } = body

  // 날짜 형식 검증 (YYYY-MM-DD)
  if (!date || !isValidDateStr(date)) {
    return NextResponse.json(
      { success: false, error: '잘못된 날짜입니다.' },
      { status: 400 }
    )
  }

  // status 필수 검증 — HOLIDAY는 관리자만 설정 가능
  const validStatuses = ['WORK', 'SICK', 'ANNUAL', 'UNPAID', 'HOLIDAY']
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { success: false, error: '올바른 근무 상태를 입력해주세요.' },
      { status: 400 }
    )
  }

  // HOLIDAY 상태는 ADMIN만 설정 가능
  if (status === 'HOLIDAY' && session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: '공휴일은 관리자만 설정할 수 있습니다.' },
      { status: 403 }
    )
  }

  // [M-003] WORK 상태 미래 날짜 차단 — KST 기준 오늘 날짜와 비교
  const today = getTodayKST()
  if (status === 'WORK' && date > today) {
    return NextResponse.json(
      { success: false, error: '미래 날짜에는 정상근무 기록을 입력할 수 없습니다.' },
      { status: 400 }
    )
  }

  // WORK 상태 필수 필드 개별 검증 — 에러 메시지를 각 필드별로 구분
  if (status === 'WORK') {
    if (!location) {
      return NextResponse.json(
        { success: false, error: '업무 장소를 입력해주세요.' },
        { status: 400 }
      )
    }
    if (!startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: '근무 시작 시간과 종료 시간을 입력해주세요.' },
        { status: 400 }
      )
    }
  }

  // totalHours 서버 계산 및 시간 변환 — 상태별로 다르게 처리
  let totalHours: number | null = null
  let startDateTime: Date | null = null
  let endDateTime: Date | null = null

  if (status === 'WORK' && startTime && endTime) {
    totalHours = calcTotalHours(date, startTime, endTime)

    // [M-009] totalHours > 0 서버 검증 — 0 또는 음수 차단 (종료 시각이 시작 시각보다 빠른 경우)
    if (totalHours <= 0) {
      return NextResponse.json(
        { success: false, error: '종료 시간이 시작 시간보다 빠릅니다.' },
        { status: 400 }
      )
    }

    // 야간 근무 자동 감지 — endTime < startTime이면 다음날 처리
    const isNightShift = endTime < startTime

    // [C-001] toUTCDateTime 사용 — setHours 미사용 (UTC 서버 환경 안전)
    startDateTime = toUTCDateTime(date, startTime)
    endDateTime = toUTCDateTime(date, endTime, isNightShift)
  } else if (['SICK', 'ANNUAL', 'HOLIDAY'].includes(status)) {
    // 병가/연차/공휴일 — 07:00~15:00 자동 8시간 처리
    startDateTime = new Date(`${date}T07:00:00Z`)
    endDateTime = new Date(`${date}T15:00:00Z`)
    totalHours = 8
  }
  // UNPAID: startTime/endTime/totalHours 모두 null 유지

  try {
    const record = await prisma.workRecord.create({
      data: {
        userId: session.user.id,         // 요청 body의 userId 무시, 세션 기준으로 고정
        date: new Date(`${date}T00:00:00Z`), // @db.Date 필드 — UTC 자정으로 저장
        status,
        startTime: startDateTime,
        endTime: endDateTime,
        totalHours,
        location: status === 'WORK' ? (location ?? null) : null, // WORK 아닌 경우 null
        description: description ?? null,
        createdBy: session.user.id,
      },
    })
    return NextResponse.json({ success: true, data: record }, { status: 201 })
  } catch (error: unknown) {
    // [C-003] Prisma UNIQUE 제약 위반 — P2002 코드로 정확히 감지 (같은 날짜 중복 기록 방지)
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: '해당 날짜에 이미 기록이 존재합니다.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
