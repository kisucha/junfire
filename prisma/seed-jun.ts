// prisma/seed-jun.ts — 추가 관리자 계정(jun) 생성 스크립트
// 목적: jun / 1234 관리자 계정 1회성 생성 (실행 후 삭제 가능)
// 실행: npx ts-node --project tsconfig.seed.json prisma/seed-jun.ts

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  // bcrypt cost factor 12 — 보안 강도 (seed.ts와 동일)
  const passwordHash = await bcrypt.hash('1234', 12)

  await prisma.user.upsert({
    where: { username: 'jun' },
    update: {},  // 이미 존재하면 변경 없음
    create: {
      username: 'jun',
      name: '준 관리자',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      isFirstLogin: false,  // 최초 로그인 비밀번호 변경 불필요
    },
  })

  process.stdout.write('jun 관리자 계정 생성 완료: jun / 1234\n')
}

main()
  .catch((err: unknown) => {
    console.error('생성 실패:', err)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
