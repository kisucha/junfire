// src/lib/pdf/generateReport.ts — PDF 생성 진입점 (데이터 가공 + 렌더링)
// 목적: 기간 내 전직원 업무 기록 조회, 직원별 집계(SummaryTable) + 날짜별 상세(DailyGrid) 형식 PDF 생성
// @react-pdf/renderer 서버사이드 전용 — 클라이언트 컴포넌트에서 import 금지

import { prisma } from '@/lib/prisma'
import type { EmployeeSummaryDTO, GenerateReportInput } from '@/types'
// renderReportDocument 와 DailyGrid 타입은 ReportDocument.tsx에서 import — 순환 의존성 없음
import { renderReportDocument } from './ReportDocument'
import type { DailyRecord, DayData, DailyGridData } from './ReportDocument'

// re-export: 다른 모듈에서 DailyGridData 등이 필요할 경우 사용 가능
export type { DailyRecord, DayData, DailyGridData }

/**
 * DB에서 직접 조회하여 PDF 생성하는 진입점
 * 직원별 집계(SummaryTable) + 날짜별 상세(DailyGrid) 형식으로 PDF 구성
 *
 * 내부 로직:
 *  - 직원 목록 / 업무 기록 / 공휴일 을 한 번에 조회
 *  - summary: /api/admin/summary 와 동일한 집계 규칙 (WORK=실시간, SICK/ANNUAL/HOLIDAY=8h, UNPAID=0)
 *  - dailyGrid: /api/admin/report/daily 와 동일한 날짜별 구성 규칙
 *
 * @param input - GenerateReportInput (startDate, endDate, includeInactive)
 * @returns PDF 파일 Buffer
 */
export async function generateReportFromDB(input: GenerateReportInput): Promise<Buffer> {
  const { startDate, endDate, includeInactive } = input

  const startDateTime = new Date(`${startDate}T00:00:00Z`)
  const endDateTime = new Date(`${endDate}T23:59:59Z`)

  // ─── 1. 직원 목록 조회 (EMPLOYEE, 가나다순) ──────────────────────────────
  const employees = await prisma.user.findMany({
    where: {
      role: 'EMPLOYEE',
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: { id: true, name: true, username: true },
    orderBy: { name: 'asc' },
  })

  // ─── 2. 기간 내 업무 기록 전체 조회 (summary + dailyGrid 모두 활용) ────────
  const workRecords = await prisma.workRecord.findMany({
    where: {
      date: { gte: startDateTime, lte: endDateTime },
      userId: { in: employees.map(e => e.id) },
    },
    select: { id: true, userId: true, date: true, status: true, totalHours: true },
    orderBy: [{ userId: 'asc' }, { date: 'asc' }],
  })

  // ─── 3. 공휴일 조회 ──────────────────────────────────────────────────────
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: startDateTime, lte: endDateTime } },
    select: { date: true, name: true },
  })

  // 공휴일 Map (date str → 공휴일명)
  const holidayMap = new Map<string, string>(
    holidays.map(h => [h.date.toISOString().slice(0, 10), h.name])
  )

  // ─── 4. 직원별 집계 계산 (SummaryTable 형식, /api/admin/summary 로직과 동일) ─

  // 직원별 초기 집계 맵 생성
  const summaryMap = new Map<string, EmployeeSummaryDTO>()
  for (const emp of employees) {
    summaryMap.set(emp.id, {
      userId: emp.id,
      name: emp.name,
      username: emp.username,
      workDays: 0,
      sickDays: 0,
      annualDays: 0,
      holidayDays: 0,
      unpaidDays: 0,
      workActualHours: 0,
      totalHours: 0,
    })
  }

  // 기록별 상태별 집계 누적
  for (const rec of workRecords) {
    const entry = summaryMap.get(rec.userId)
    if (!entry) continue
    if (rec.status === 'WORK') {
      entry.workDays++
      entry.workActualHours += rec.totalHours ?? 0
    } else if (rec.status === 'SICK') {
      entry.sickDays++
    } else if (rec.status === 'ANNUAL') {
      entry.annualDays++
    } else if (rec.status === 'HOLIDAY') {
      entry.holidayDays++
    } else if (rec.status === 'UNPAID') {
      entry.unpaidDays++
    }
  }

  // 총 근무시간 계산 (SICK/ANNUAL/HOLIDAY = 8h 고정) + 소수점 1자리 반올림
  const summary: EmployeeSummaryDTO[] = employees.map(emp => {
    const entry = summaryMap.get(emp.id)!
    entry.workActualHours = Math.round(entry.workActualHours * 10) / 10
    entry.totalHours =
      Math.round(
        (entry.workActualHours + (entry.sickDays + entry.annualDays + entry.holidayDays) * 8) * 10
      ) / 10
    return entry
  })

  // ─── 5. 날짜별 상세 데이터 계산 (DailyGrid 형식, /api/admin/report/daily 로직과 동일) ─

  // 근무 기록 Map (userId → date str → record)
  type WorkRecordRaw = (typeof workRecords)[0]
  const recordMap = new Map<string, Map<string, WorkRecordRaw>>()
  for (const rec of workRecords) {
    const dateStr = rec.date.toISOString().slice(0, 10)
    if (!recordMap.has(rec.userId)) recordMap.set(rec.userId, new Map())
    recordMap.get(rec.userId)!.set(dateStr, rec)
  }

  // startDate ~ endDate 전체 날짜 순회 → days 배열 생성
  const days: DayData[] = []
  const cur = new Date(startDateTime)

  while (cur <= endDateTime) {
    const dateStr = cur.toISOString().slice(0, 10)
    const dayOfWeek = cur.getUTCDay()  // 0=일, 6=토
    const isHoliday = holidayMap.has(dateStr)
    const holidayName = holidayMap.get(dateStr) ?? null

    // 직원별 근무시간 계산
    const records: Record<string, DailyRecord> = {}
    for (const emp of employees) {
      const rec = recordMap.get(emp.id)?.get(dateStr)
      if (!rec) continue
      // UNPAID: 0시간 처리 (표시하지 않음) — daily route 동일 규칙
      if (rec.status === 'UNPAID') continue

      let hours = 0
      if (rec.status === 'WORK') {
        // WORK: 실제 근무시간 (소수점 1자리 반올림)
        hours = Math.round((rec.totalHours ?? 0) * 10) / 10
      } else {
        // SICK / ANNUAL / HOLIDAY: 8시간 고정
        hours = 8
      }
      records[emp.id] = { hours, status: rec.status }
    }

    days.push({ date: dateStr, dayOfWeek, isHoliday, holidayName, records })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  const dailyGrid: DailyGridData = {
    employees: employees.map(e => ({ id: e.id, name: e.name })),
    days,
  }

  // ─── 6. PDF 렌더링 ──────────────────────────────────────────────────────
  // renderReportDocument (ReportDocument.tsx의 .tsx 함수) 호출 — JSX transform 보장
  return renderReportDocument({
    startDate,
    endDate,
    summary,
    dailyGrid,
    generatedAt: new Date().toISOString(),
  })
}
