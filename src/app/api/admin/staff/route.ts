// src/app/api/admin/staff/route.ts
// 목적: 직원 목록 조회(GET) + 직원 등록(POST) API
// - GET: 전체 로드 (take:100 고정 — 소규모 5명 최적화, M-002 우회 전략)
// - POST: 직원 신규 등록, 이메일 중복 체크, bcrypt 해시, isFirstLogin=true

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import bcrypt from 'bcryptjs'

// GET: 직원 목록 전체 로드
// [M-002] staff는 최대 5명 소규모 — take:100으로 1회 전체 로드 (cursor 페이징 우회)
// 쿼리 파라미터: includeInactive?(기본 false)
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

  // 비활성 직원 포함 여부 — 기본 false (활성 직원만)
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const users = await prisma.user.findMany({
    where: includeInactive ? {} : { isActive: true },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      isFirstLogin: true,
      createdAt: true,
      // passwordHash 필드는 절대 응답에 포함하지 않음 (보안)
    },
    orderBy: { name: 'asc' },
    // [M-002] 소규모 5명 — 100개 고정으로 전체 1회 로드 (페이징 불필요)
    take: 100,
  })

  return NextResponse.json({ success: true, data: users })
}

// POST: 직원 등록
// Body: { username, name, password, role? }
export async function POST(req: NextRequest) {
  // 세션 검증 + ADMIN 권한 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const { username, name, password, role } = await req.json()

  // 필수 필드 검증
  if (!username || !name || !password) {
    return NextResponse.json(
      { error: '아이디, 이름, 비밀번호를 모두 입력해주세요.' },
      { status: 400 }
    )
  }

  // 비밀번호 정책: 최소 4자 이상
  if (password.length < 4) {
    return NextResponse.json(
      { error: '비밀번호는 4자 이상이어야 합니다.' },
      { status: 400 }
    )
  }

  // role 유효성 검증 — EMPLOYEE 또는 ADMIN만 허용
  const validRoles = ['EMPLOYEE', 'ADMIN']
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: '올바른 역할을 입력해주세요.' }, { status: 400 })
  }

  try {
    // 비밀번호 해시 생성 — cost factor 12
    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        username,
        name,
        passwordHash,
        role: role ?? 'EMPLOYEE', // role 미입력 시 기본값 EMPLOYEE
        isFirstLogin: true,       // 최초 로그인 강제 비밀번호 변경 플래그
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        isFirstLogin: true,
        createdAt: true,
        // passwordHash 응답 제외 (보안)
      },
    })

    // 등록 완료 후 초기 비밀번호 1회 반환 (관리자 화면에서 직원에게 안내용)
    return NextResponse.json(
      { success: true, data: user, initialPassword: password },
      { status: 201 }
    )
  } catch (error: unknown) {
    // [C-003] P2002 아이디 중복 에러 처리
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: '이미 사용 중인 아이디입니다.' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
