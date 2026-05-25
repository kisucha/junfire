// src/lib/pdf/generateReport.ts — PDF 생성 진입점 (데이터 가공 + 렌더링)
// 목적: 기간 내 전직원 업무 기록 조회, 직원별 집계, @react-pdf/renderer 버퍼 반환
// @react-pdf/renderer 서버사이드 전용 — 클라이언트 컴포넌트에서 import 금지

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { formatHoursToDisplay } from '@/lib/utils/time'
// formatDateKo, getDayOfWeekKo는 ReportDocument.tsx에서 직접 사용
import type { WorkRecordDTO, HolidayDTO, GenerateReportInput, Role, RecordStatus } from '@/types'
import { ReportDocument } from './ReportDocument'

// ===== 내부 집계 타입 =====

// 직원별 집계 결과 타입 — ReportDocument에 전달
export interface UserReportEntry {
  // 직원 기본 정보
  user: {
    id: string
    name: string
    username: string
    role: Role
  }
  // 집계 수치
  totalWorkDays: number   // WORK 상태 일수
  totalWorkHours: number  // 총 근무시간 합산 (float)
  sickDays: number        // 병가 일수
  annualDays: number      // 연차 일수
  unpaidDays: number      // 무급 일수
  holidayDays: number     // 공휴일 일수 (WorkRecord에 HOLIDAY 기록이 있는 경우)
  // 날짜별 상세 기록 (날짜 오름차순 정렬)
  records: WorkRecordDTO[]
}

// PDF 생성 함수 파라미터 타입 — API Route에서 직접 데이터 주입 방식과
// DB 조회 방식 모두 지원 (오버로드 없이 단일 함수)
export type GenerateReportParams = {
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
}

// ===== PDF 생성 진입점 =====

/**
 * 기간 내 전직원 업무 기록 조회 후 PDF 버퍼 반환
 * [M-011] PDF 생성은 전체 로드 (페이징 없음) — 5명 소규모 수백 건 수준으로 timeout 위험 없음
 *
 * @param records - JOIN된 사용자 정보 포함 업무 기록 배열
 * @param holidays - 기간 내 공휴일 배열
 * @param params - 기간 파라미터 (startDate, endDate)
 * @returns PDF 파일 Buffer
 */
export async function generateReportPDF(
  records: (WorkRecordDTO & { user: { id: string; name: string; username: string; role: string } })[],
  holidays: HolidayDTO[],
  params: GenerateReportParams
): Promise<Buffer> {
  const { startDate, endDate } = params

  // --- 1. holidayMap 생성 (NF-V2-003) ---
  // date(YYYY-MM-DD) → 공휴일명 Map — 상세 테이블에서 O(1) 조회
  const holidayMap = new Map<string, string>()
  for (const h of holidays) {
    holidayMap.set(h.date, h.name)
  }

  // --- 2. userId 기준 직원별 기록 그룹화 ---
  const userMap = new Map<string, UserReportEntry>()

  for (const record of records) {
    const uid = record.userId

    if (!userMap.has(uid)) {
      // 최초 등장 시 초기 집계 엔트리 생성
      userMap.set(uid, {
        user: {
          id: uid,
          name: record.user.name,
          username: record.user.username,
          role: record.user.role as Role,
        },
        totalWorkDays: 0,
        totalWorkHours: 0,
        sickDays: 0,
        annualDays: 0,
        unpaidDays: 0,
        holidayDays: 0,
        records: [],
      })
    }

    const entry = userMap.get(uid)!

    // 기록 추가
    entry.records.push(record)

    // --- 3. 직원별 집계 계산 ---
    const status = record.status as RecordStatus
    if (status === 'WORK') {
      entry.totalWorkDays++
      entry.totalWorkHours += record.totalHours ?? 0
    } else if (status === 'SICK') {
      entry.sickDays++
    } else if (status === 'ANNUAL') {
      entry.annualDays++
    } else if (status === 'UNPAID') {
      entry.unpaidDays++
    } else if (status === 'HOLIDAY') {
      // 공휴일 기록이 WorkRecord에 직접 등록된 경우 집계 (Holiday 테이블과 별개)
      entry.holidayDays++
    }
  }

  // --- 4. 직원 가나다순 정렬 ---
  const sortedUsers = Array.from(userMap.values()).sort((a, b) =>
    a.user.name.localeCompare(b.user.name, 'ko')
  )

  // --- 5. 총 근무시간 소수점 2자리 반올림 ---
  for (const entry of sortedUsers) {
    entry.totalWorkHours = Math.round(entry.totalWorkHours * 100) / 100
  }

  // --- 6. @react-pdf/renderer로 PDF 버퍼 생성 ---
  // React.createElement 사용 — JSX transform 의존 없이 서버사이드 안전 호출
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(
    React.createElement(ReportDocument, {
      startDate,
      endDate,
      sortedUsers,
      holidayMap,
      generatedAt: new Date().toISOString(),
    }) as any
  )

  return pdfBuffer as Buffer
}

/**
 * DB에서 직접 조회하여 PDF 생성하는 편의 함수
 * API Route /api/admin/report 에서 사용
 * GenerateReportInput의 includeInactive 플래그 반영
 *
 * @param input - GenerateReportInput (startDate, endDate, includeInactive)
 * @returns PDF 파일 Buffer
 */
export async function generateReportFromDB(input: GenerateReportInput): Promise<Buffer> {
  const { startDate, endDate, includeInactive } = input

  // UTC 기준 날짜 범위 (WorkRecord.date는 YYYY-MM-DDT00:00:00Z 형식으로 저장됨)
  const startDateTime = new Date(`${startDate}T00:00:00Z`)
  const endDateTime = new Date(`${endDate}T23:59:59Z`)

  // 1. 기간 내 전직원 업무 기록 전체 조회 (PDF는 페이징 없이 전체 로드)
  const rawRecords = await prisma.workRecord.findMany({
    where: {
      date: { gte: startDateTime, lte: endDateTime },
      // includeInactive=false이면 활성 직원만 필터링
      ...(includeInactive ? {} : { user: { isActive: true } }),
    },
    include: {
      user: {
        select: { id: true, name: true, username: true, role: true },
      },
    },
    orderBy: [{ userId: 'asc' }, { date: 'asc' }],
  })

  // 2. Holiday 테이블 별도 조회 (NF-003 — WorkRecord와 분리)
  const rawHolidays = await prisma.holiday.findMany({
    where: { date: { gte: startDateTime, lte: endDateTime } },
    orderBy: { date: 'asc' },
  })

  // Prisma 결과를 DTO 형식으로 변환
  const records = rawRecords.map(r => ({
    id: r.id,
    userId: r.userId,
    date: r.date.toISOString().slice(0, 10),  // YYYY-MM-DD
    status: r.status as RecordStatus,
    startTime: r.startTime?.toISOString() ?? null,
    endTime: r.endTime?.toISOString() ?? null,
    totalHours: r.totalHours ?? null,
    location: r.location ?? null,
    description: r.description ?? null,
    createdBy: r.createdBy,
    updatedBy: r.updatedBy ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    user: {
      id: r.user.id,
      name: r.user.name,
      username: r.user.username,
      role: r.user.role,
    },
  }))

  const holidays: HolidayDTO[] = rawHolidays.map(h => ({
    id: h.id,
    date: h.date.toISOString().slice(0, 10),
    name: h.name,
    createdBy: h.createdBy,
    createdAt: h.createdAt.toISOString(),
  }))

  return generateReportPDF(records, holidays, { startDate, endDate })
}
