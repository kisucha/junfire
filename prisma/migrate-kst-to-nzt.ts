// prisma/migrate-kst-to-nzt.ts
// 목적: 기존 DB 업무 기록 시간을 KST 기준 → NZT(뉴질랜드) 기준으로 일괄 변환
//
// 배경:
//   기존 저장 방식: 입력 시간을 KST(UTC+9)로 해석하여 UTC 변환 저장
//   새로운 방식:   입력 시간을 NZT(UTC+12/+13)로 해석하여 UTC 변환 저장
//
// 변환 계산:
//   KST(UTC+9) 기준 저장 → NZT(NZST UTC+12) 기준으로 재저장
//   조정량: -(12 - 9) = -3시간 (NZST 기준)
//   → 기존 UTC 시간에서 3시간 차감
//
// 실행 방법:
//   npx ts-node --project tsconfig.json prisma/migrate-kst-to-nzt.ts
//
// ⚠️ 주의: 실행 전 반드시 DB 백업 필수

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 시간 데이터가 있는 기록 조회 (startTime이 null이 아닌 것만)
  const records = await prisma.workRecord.findMany({
    where: {
      startTime: { not: null },
    },
    select: {
      id: true,
      date: true,
      status: true,
      startTime: true,
      endTime: true,
    },
  })

  console.log(`총 ${records.length}개 기록 변환 시작...`)
  console.log('KST(UTC+9) → NZT(NZST UTC+12): UTC 기준 3시간 차감')
  console.log('')

  // 3시간 = 10800초 = 10,800,000 밀리초
  const ADJUST_MS = 3 * 60 * 60 * 1000

  let successCount = 0
  let errorCount = 0

  for (const record of records) {
    try {
      const dateStr = record.date.toISOString().slice(0, 10)

      // startTime/endTime에서 3시간 차감 (KST→NZT 변환)
      const newStartTime = record.startTime
        ? new Date(record.startTime.getTime() - ADJUST_MS)
        : null
      const newEndTime = record.endTime
        ? new Date(record.endTime.getTime() - ADJUST_MS)
        : null

      await prisma.workRecord.update({
        where: { id: record.id },
        data: {
          startTime: newStartTime,
          endTime: newEndTime,
        },
      })

      const oldStart = record.startTime
        ? `${String(record.startTime.getUTCHours()).padStart(2, '0')}:${String(record.startTime.getUTCMinutes()).padStart(2, '0')} UTC`
        : '-'
      const newStart = newStartTime
        ? `${String(newStartTime.getUTCHours()).padStart(2, '0')}:${String(newStartTime.getUTCMinutes()).padStart(2, '0')} UTC`
        : '-'

      console.log(
        `[OK] ${dateStr} (${record.status}) | startTime: ${oldStart} → ${newStart}`
      )
      successCount++
    } catch (err) {
      console.error(`[ERROR] record.id=${record.id}:`, err)
      errorCount++
    }
  }

  console.log('')
  console.log(`변환 완료: 성공 ${successCount}개, 실패 ${errorCount}개`)
}

main()
  .catch((err) => {
    console.error('마이그레이션 오류:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
