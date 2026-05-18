// src/app/api/admin/staff/[id]/route.ts
// 목적: 직원 단건 조회(GET) + 정보 수정(PUT) + 상태 변경 및 비밀번호 초기화(PATCH)
// - GET: 직원 단건 조회 (passwordHash 제외)
// - PUT: 직원 이름/역할 수정
// - PATCH: 비활성화/재활성화/비밀번호 초기화 (NF-V2-002)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'

// 공통 select 옵션 — passwordHash 절대 미포함 (보안)
const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  isFirstLogin: true,
  createdAt: true,
}

// GET: 직원 단건 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 세션 검증 + ADMIN 권한 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  })

  if (!user) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: user })
}

// PUT: 직원 정보 수정
// Body: { name?, role? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 세션 검증 + ADMIN 권한 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await params

  // 대상 직원 존재 확인
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  const { name, role } = await req.json()

  // role 유효성 검증 — 입력된 경우만 검증
  const validRoles: Role[] = ['EMPLOYEE', 'ADMIN']
  if (role && !validRoles.includes(role as Role)) {
    return NextResponse.json({ error: '올바른 역할을 입력해주세요.' }, { status: 400 })
  }

  // 수정할 필드만 업데이트 (undefined 필드 제외)
  const updateData: { name?: string; role?: Role } = {}
  if (name !== undefined) updateData.name = name as string
  if (role !== undefined) updateData.role = role as Role

  try {
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error: unknown) {
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

// PATCH: 계정 상태 변경 및 비밀번호 초기화 (NF-V2-002)
// Body: { action: 'deactivate' | 'activate' | 'reset-password', tempPassword?: string }
// StaffTable에서는 { isActive: boolean } 형태도 지원 (하위 호환)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 세션 검증 + ADMIN 권한 확인
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await params

  // 대상 직원 존재 확인
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  const body = await req.json()
  const { action, tempPassword, isActive } = body

  // StaffTable에서 { isActive } 직접 전송 방식 지원
  if (typeof isActive === 'boolean') {
    await prisma.user.update({ where: { id }, data: { isActive } })
    return NextResponse.json({ success: true, message: isActive ? '계정이 재활성화되었습니다.' : '계정이 비활성화되었습니다.' })
  }

  // 계정 비활성화 (소프트 삭제)
  if (action === 'deactivate') {
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true, message: '계정이 비활성화되었습니다.' })
  }

  // 계정 재활성화
  if (action === 'activate') {
    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    })
    return NextResponse.json({ success: true, message: '계정이 재활성화되었습니다.' })
  }

  // [NF-V2-002] 비밀번호 초기화
  if (action === 'reset-password') {
    if (!tempPassword) {
      return NextResponse.json(
        { error: '임시 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 비밀번호 정책 검증 (최소 4자)
    if (tempPassword.length < 4) {
      return NextResponse.json(
        { error: '임시 비밀번호는 4자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 1. 임시 비밀번호 해시화 — cost factor 12
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    // 2. 비밀번호 업데이트 + isFirstLogin=true 재설정
    //    → 해당 직원이 다음 로그인 시 /change-password 강제 이동 (RESEARCH.md 3.7)
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        isFirstLogin: true, // [NF-V2-002] 비밀번호 초기화 시 isFirstLogin=true 필수
      },
    })

    // 3. 임시 비밀번호 1회 응답 반환 (관리자 화면에서 직원에게 안내용)
    //    DB에는 해시만 저장됨 — 평문 비밀번호 재조회 불가
    return NextResponse.json({
      success: true,
      message: '비밀번호가 초기화되었습니다.',
      tempPassword, // 1회 표시용 — 화면에서 관리자가 직원에게 구두 전달
    })
  }

  return NextResponse.json(
    { error: '유효하지 않은 action입니다.' },
    { status: 400 }
  )
}
