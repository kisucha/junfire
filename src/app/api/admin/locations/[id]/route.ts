// src/app/api/admin/locations/[id]/route.ts
// 목적: 업무 현장 수정(PATCH) 및 삭제(DELETE) — ADMIN 전용

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH: 현장 이름 수정 또는 활성/비활성 토글
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const updateData: { name?: string; isActive?: boolean } = {}

  if (body.name !== undefined) {
    if (!body.name.trim()) {
      return NextResponse.json({ success: false, error: '현장 이름을 입력해주세요.' }, { status: 400 })
    }
    const dup = await prisma.workLocation.findFirst({
      where: { name: body.name.trim(), NOT: { id } },
    })
    if (dup) {
      return NextResponse.json({ success: false, error: '이미 등록된 현장 이름입니다.' }, { status: 409 })
    }
    updateData.name = body.name.trim()
  }

  if (body.isActive !== undefined) {
    updateData.isActive = body.isActive
  }

  const updated = await prisma.workLocation.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json({ success: true, data: updated })
}

// DELETE: 현장 삭제 (기존 WorkRecord.location 값에는 영향 없음)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await params
  await prisma.workLocation.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
