// src/app/api/password/route.ts
// 목적: 비밀번호 변경 API Route (M-004)
// - PUT: 현재 비밀번호 검증 → 새 비밀번호 정책 검증 → bcrypt 해시 후 저장
// - isFirstLogin=false 동시 업데이트 (최초 로그인 강제 변경 플래그 해제)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// PUT: 비밀번호 변경
// EMPLOYEE, ADMIN 모두 허용 — 세션 userId 기준으로 본인 비밀번호만 변경
export async function PUT(req: NextRequest) {
  // 인증 확인 — 미인증 시 401 반환
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }

  const { currentPassword, newPassword } = await req.json()

  // 필수 필드 검증 — 현재/새 비밀번호 모두 필수
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { success: false, error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' },
      { status: 400 }
    )
  }

  // 1. 현재 사용자 조회 — passwordHash 필드 포함
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) {
    return NextResponse.json(
      { success: false, error: '사용자를 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  // 2. 현재 비밀번호 검증 — bcrypt.compare로 해시값과 비교
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!isValid) {
    return NextResponse.json(
      { success: false, error: '현재 비밀번호가 올바르지 않습니다.' },
      { status: 400 }
    )
  }

  // 3. 새 비밀번호 길이 정책 검증 — 최소 4자 이상
  if (newPassword.length < 4) {
    return NextResponse.json(
      { success: false, error: '비밀번호는 최소 4자 이상이어야 합니다.' },
      { status: 400 }
    )
  }

  // 4. 현재 비밀번호와 동일 여부 확인 — 동일하면 변경 거부
  const isSame = await bcrypt.compare(newPassword, user.passwordHash)
  if (isSame) {
    return NextResponse.json(
      { success: false, error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' },
      { status: 400 }
    )
  }

  // 6. 새 비밀번호 bcrypt 해시 후 저장 (cost factor 12)
  const newHash = await bcrypt.hash(newPassword, 12)

  // 비밀번호 변경 + isFirstLogin=false 동시 업데이트
  // isFirstLogin=false: 최초 로그인 강제 변경 완료 플래그 해제 — /change-password 리다이렉트 해제
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: newHash,
      isFirstLogin: false,
    },
  })

  return NextResponse.json(
    { success: true, message: '비밀번호가 변경되었습니다.' },
    { status: 200 }
  )
}
