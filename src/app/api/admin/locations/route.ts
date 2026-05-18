// src/app/api/admin/locations/route.ts
// 목적: 업무 현장 목록 조회(GET) 및 신규 등록(POST) — ADMIN 전용

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: 전체 현장 목록 (활성/비활성 모두)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  const locations = await prisma.workLocation.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ success: true, data: locations })
}

// POST: 현장 등록
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  const { name } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: '현장 이름을 입력해주세요.' }, { status: 400 })
  }

  // 중복 이름 확인
  const existing = await prisma.workLocation.findUnique({ where: { name: name.trim() } })
  if (existing) {
    return NextResponse.json({ success: false, error: '이미 등록된 현장 이름입니다.' }, { status: 409 })
  }

  const location = await prisma.workLocation.create({
    data: { name: name.trim(), createdBy: session.user.id },
  })

  return NextResponse.json({ success: true, data: location }, { status: 201 })
}
