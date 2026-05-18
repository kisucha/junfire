// src/app/api/admin/records/override/route.ts
// 목적: 관리자 직원 업무 기록 대리 입력 API (NF-001)
// - POST: 직원 누락 기록 upsert (기존 기록 있으면 UPDATE, 없으면 INSERT)
// - createdBy/updatedBy에 관리자 ID 기록 (감사 추적, BR-011)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { isValidDateStr, getTodayKST } from '@/lib/utils/date'
import { calcTotalHours, toUTCDateTime } from '@/lib/utils/time'
import type { AdminOverrideInput } from '@/types'

// POST: 직원 기록 대리 생성/수정 (upsert)
// Body: { targetUserId, date, status, startTime?, endTime?, location?, description? }
export async function POST(req: NextRequest) {
  // 세션 검증 + ADMIN 권한 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const body: AdminOverrideInput = await req.json()
  const { targetUserId, date, status, startTime, endTime, location, description } = body

  // 대리 입력 대상 직원 ID 필수 검증
  if (!targetUserId) {
    return NextResponse.json({ error: '대상 직원 ID를 입력해주세요.' }, { status: 400 })
  }

  // 대상 직원 존재 확인 — 비활성 직원도 대리 입력 가능 (관리 목적)
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!targetUser) {
    return NextResponse.json({ error: '존재하지 않는 직원입니다.' }, { status: 404 })
  }

  // 날짜 형식 검증 (YYYY-MM-DD)
  if (!date || !isValidDateStr(date)) {
    return NextResponse.json({ error: '잘못된 날짜입니다.' }, { status: 400 })
  }

  // status 필수 검증
  const validStatuses = ['WORK', 'SICK', 'ANNUAL', 'UNPAID']
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: '올바른 근무 상태를 입력해주세요.' }, { status: 400 })
  }

  // [M-003] WORK 상태 미래 날짜 차단 — KST 기준 오늘 날짜와 비교
  const today = getTodayKST()
  if (status === 'WORK' && date > today) {
    return NextResponse.json(
      { error: '미래 날짜에는 정상근무 기록을 입력할 수 없습니다.' },
      { status: 400 }
    )
  }

  // WORK 상태 필수 필드 검증 — location, startTime, endTime 필수
  if (status === 'WORK') {
    if (!location) {
      return NextResponse.json({ error: '업무 장소를 입력해주세요.' }, { status: 400 })
    }
    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: '근무 시작 시간과 종료 시간을 입력해주세요.' },
        { status: 400 }
      )
    }
  }

  // totalHours 서버 계산 및 시간 변환 — WORK 상태에서만 수행
  let totalHours: number | null = null
  let startDateTime: Date | null = null
  let endDateTime: Date | null = null

  if (status === 'WORK' && startTime && endTime) {
    totalHours = calcTotalHours(date, startTime, endTime)

    // [M-009] totalHours > 0 검증 — 0 또는 음수 차단
    if (totalHours <= 0) {
      return NextResponse.json(
        { error: '종료 시간이 시작 시간보다 빠릅니다.' },
        { status: 400 }
      )
    }

    // 야간 근무 자동 감지 — endTime < startTime이면 다음날 처리
    const isNightShift = endTime < startTime

    // [C-001] toUTCDateTime 사용 — setHours 미사용 (UTC 서버 환경 안전)
    startDateTime = toUTCDateTime(date, startTime)
    endDateTime = toUTCDateTime(date, endTime, isNightShift)
  }

  try {
    // [NF-001] upsert: 기존 기록 있으면 UPDATE, 없으면 INSERT
    // userId_date 복합 유니크 키 기준으로 판단
    const existing = await prisma.workRecord.findUnique({
      where: { userId_date: { userId: targetUserId, date: new Date(`${date}T00:00:00Z`) } },
    })

    const record = await prisma.workRecord.upsert({
      where: { userId_date: { userId: targetUserId, date: new Date(`${date}T00:00:00Z`) } },
      update: {
        status,
        startTime: startDateTime,
        endTime: endDateTime,
        totalHours,
        location: status === 'WORK' ? (location ?? null) : null,
        description: description ?? null,
        // [BR-011] 관리자 대리 입력 추적 — 수정자 ID 기록
        updatedBy: session.user.id,
      },
      create: {
        userId: targetUserId,
        date: new Date(`${date}T00:00:00Z`), // @db.Date 필드 — UTC 자정으로 저장
        status,
        startTime: startDateTime,
        endTime: endDateTime,
        totalHours,
        location: status === 'WORK' ? (location ?? null) : null,
        description: description ?? null,
        // [BR-011] 관리자 대리 입력 추적 — 생성자/수정자 ID 모두 관리자 ID로 기록
        createdBy: session.user.id,
        updatedBy: session.user.id,
      },
    })

    // 신규 생성이면 201, 기존 수정이면 200
    const statusCode = existing ? 200 : 201
    return NextResponse.json({ success: true, data: record }, { status: statusCode })
  } catch (error: unknown) {
    // [C-003] P2002 UNIQUE 에러 감지 — upsert 이후 발생 시 예외 처리
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: '해당 날짜에 이미 기록이 존재합니다.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
