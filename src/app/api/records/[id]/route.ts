// src/app/api/records/[id]/route.ts
// 목적: 업무 기록 단건 조회(GET) / 수정(PUT) / 삭제(DELETE) API Route
// - [M-005] 소유자 검증: EMPLOYEE는 본인 기록만, ADMIN은 모든 기록 접근 가능
// - PUT: WORK 상태 유효성 검증 + totalHours 재계산
// - DELETE: 성공 시 204 No Content 반환

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { isValidDateStr, getTodayKST } from '@/lib/utils/date'
import { calcTotalHours, toUTCDateTime } from '@/lib/utils/time'
import type { UpdateRecordInput } from '@/types'

// GET: 업무 기록 단건 조회
// EMPLOYEE: 본인 기록만 / ADMIN: 모든 기록 열람 가능
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 인증 확인 — 미인증 시 401 반환
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }

  const { id } = await params

  // 기록 조회 — 미존재 시 404 반환
  const record = await prisma.workRecord.findUnique({
    where: { id },
  })
  if (!record) {
    return NextResponse.json(
      { success: false, error: '기록을 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  // [M-005] 소유자 검증 — ADMIN은 모든 기록 열람 가능, EMPLOYEE는 본인 기록만
  if (record.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: '접근 권한이 없습니다.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ success: true, data: record })
}

// PUT: 업무 기록 수정
// EMPLOYEE: 본인 기록만 수정 / ADMIN: 모든 기록 수정 가능 + updatedBy 기록
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 인증 확인 — 미인증 시 401 반환
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }

  const { id } = await params

  // 기록 조회 — 미존재 시 404 반환
  const record = await prisma.workRecord.findUnique({
    where: { id },
  })
  if (!record) {
    return NextResponse.json(
      { success: false, error: '기록을 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  // [M-005] 소유자 검증 — ADMIN은 모든 기록 수정 가능, EMPLOYEE는 본인 기록만
  if (record.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: '접근 권한이 없습니다.' },
      { status: 403 }
    )
  }

  const body: UpdateRecordInput = await req.json()
  const { date, status, startTime, endTime, location, description } = body

  // 날짜 형식 검증 (YYYY-MM-DD) — date가 제공된 경우에만 검증
  if (date && !isValidDateStr(date)) {
    return NextResponse.json(
      { success: false, error: '잘못된 날짜입니다.' },
      { status: 400 }
    )
  }

  // [M-003] WORK 미래 날짜 차단 — KST 기준 오늘 날짜와 비교
  if (status === 'WORK' && date && date > getTodayKST()) {
    return NextResponse.json(
      { success: false, error: '미래 날짜에는 정상근무 기록을 입력할 수 없습니다.' },
      { status: 400 }
    )
  }

  // WORK 상태 필수 필드 개별 검증 — status가 WORK로 변경되는 경우 적용
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

  // totalHours 재계산 — WORK 상태에서 시간 정보가 제공된 경우에만 수행
  let totalHours: number | null = null
  let startDateTime: Date | null = null
  let endDateTime: Date | null = null

  if (status === 'WORK' && startTime && endTime) {
    // 날짜: 수정 요청에 date가 없으면 기존 기록의 날짜 사용
    const targetDate = date ?? record.date.toISOString().slice(0, 10)
    totalHours = calcTotalHours(targetDate, startTime, endTime)

    // [M-009] totalHours > 0 서버 검증 — 0 또는 음수 차단
    if (totalHours <= 0) {
      return NextResponse.json(
        { success: false, error: '종료 시간이 시작 시간보다 빠릅니다.' },
        { status: 400 }
      )
    }

    // 야간 근무 자동 감지 — endTime < startTime이면 다음날 처리
    const isNightShift = endTime < startTime

    // [C-001] toUTCDateTime 사용 — setHours 미사용 (UTC 서버 환경 안전)
    startDateTime = toUTCDateTime(targetDate, startTime)
    endDateTime = toUTCDateTime(targetDate, endTime, isNightShift)
  }

  try {
    const updated = await prisma.workRecord.update({
      where: { id },
      data: {
        // 각 필드는 요청에 포함된 경우에만 업데이트 (undefined이면 변경 없음)
        ...(date ? { date: new Date(`${date}T00:00:00Z`) } : {}),
        ...(status ? { status } : {}),
        ...(startDateTime !== null ? { startTime: startDateTime } : {}),
        ...(endDateTime !== null ? { endTime: endDateTime } : {}),
        ...(totalHours !== null ? { totalHours } : {}),
        // location: WORK 상태에서만 설정, 그 외 상태로 변경 시 null로 초기화
        ...(location !== undefined
          ? { location: status === 'WORK' ? location : null }
          : {}),
        ...(description !== undefined ? { description: description ?? null } : {}),
        updatedBy: session.user.id, // 마지막 수정자 ID 기록 (관리자 대리 수정 추적용)
      },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (error: unknown) {
    // [C-003] Prisma UNIQUE 제약 위반 — P2002 코드로 정확히 감지 (날짜 중복 변경 시)
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

// DELETE: 업무 기록 삭제
// EMPLOYEE: 본인 기록만 삭제 / ADMIN: 모든 기록 삭제 가능
// 성공 시 204 No Content 반환
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 인증 확인 — 미인증 시 401 반환
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }

  const { id } = await params

  // 기록 조회 — 미존재 시 404 반환
  const record = await prisma.workRecord.findUnique({
    where: { id },
  })
  if (!record) {
    return NextResponse.json(
      { success: false, error: '기록을 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  // [M-005] 소유자 검증 — ADMIN은 모든 기록 삭제 가능, EMPLOYEE는 본인 기록만
  if (record.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: '접근 권한이 없습니다.' },
      { status: 403 }
    )
  }

  // 기록 삭제
  await prisma.workRecord.delete({ where: { id } })

  // 성공 시 204 No Content (body 없음)
  return new NextResponse(null, { status: 204 })
}
