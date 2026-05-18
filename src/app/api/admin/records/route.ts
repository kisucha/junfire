// src/app/api/admin/records/route.ts
// 목적: 관리자 전직원 업무 기록 조회 API
// - GET: cursor 기반 페이징 + 날짜 범위 필터 + 직원 필터 + 비활성 직원 포함 여부
// [M-002] admin/records orderBy: [date, userId] 복합 정렬, cursor는 id 기반으로 동작

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildCursorQuery, buildCursorResult } from '@/lib/utils/pagination'

// GET: 전직원 기록 조회 — cursor 기반 페이징 + 날짜 범위 필터
// 쿼리 파라미터: cursor?, take?(기본 20), startDate?(YYYY-MM-DD), endDate?(YYYY-MM-DD),
//               userId?(특정 직원 필터), includeInactive?(기본 false)
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

  // cursor: 이전 페이지 마지막 레코드 id (없으면 첫 페이지부터 조회)
  const cursor = searchParams.get('cursor') ?? undefined

  // take: 가져올 건수, 기본 20, 최대 200으로 제한
  const take = Math.min(Number(searchParams.get('take') ?? 20), 200)

  // 날짜 범위 필터 — YYYY-MM-DD 형식
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  // 특정 직원 필터 — 없으면 전체 직원
  const userId = searchParams.get('userId') ?? undefined

  // 비활성 직원 포함 여부 — 기본 false (활성 직원만)
  const includeInactive = searchParams.get('includeInactive') === 'true'

  // [M-002] admin/records는 orderBy: [date, userId] 복합 정렬
  // cursor는 id 기반으로 동작 — take를 충분히 크게 설정하여 실용적 허용
  const cursorQuery = buildCursorQuery({ cursor, take, cursorField: 'id' })

  // [C-002] 날짜 범위 where 조건 — YYYY-MM-DD 기준 UTC 변환
  // startDate 00:00:00 KST ~ endDate 23:59:59 KST 범위 포함
  const dateFilter =
    startDate && endDate
      ? {
          date: {
            gte: new Date(`${startDate}T00:00:00+09:00`),
            lte: new Date(`${endDate}T23:59:59+09:00`),
          },
        }
      : {}

  // 비활성 직원 제외 조건 — includeInactive=false이면 활성 직원만 포함
  const userFilter = includeInactive ? {} : { user: { isActive: true } }

  // 특정 직원 필터 조건
  const userIdFilter = userId ? { userId } : {}

  const records = await prisma.workRecord.findMany({
    where: {
      ...dateFilter,
      ...userFilter,
      ...userIdFilter,
    },
    include: {
      // 직원 정보 JOIN — 관리자 조회용 (passwordHash 절대 미포함)
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          isActive: true,
        },
      },
    },
    // [M-002] 날짜 내림차순 → 직원 ID 오름차순 복합 정렬
    orderBy: [{ date: 'desc' }, { userId: 'asc' }],
    take: cursorQuery.take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })

  // cursor 페이징 결과 변환 후 응답
  const result = buildCursorResult(records, take)
  return NextResponse.json({ success: true, ...result })
}
