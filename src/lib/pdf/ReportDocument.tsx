// src/lib/pdf/ReportDocument.tsx — @react-pdf/renderer PDF 문서 정의
// 목적: JunFire Protection 업무 기록 보고서 PDF 레이아웃 컴포넌트
// 레이아웃: 표지 + 직원별 집계(SummaryTable) + 날짜별 상세 기록(DailyGrid 크로스 테이블)
// Noto Sans KR 한글 폰트 내장 (TTF 파일 임베드) — 서버사이드 전용, 클라이언트 import 금지

import React from 'react'
import fs from 'fs'
import {
  Document,
  Page,
  Text,
  View,
  Font,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import path from 'path'
import { formatInTimeZone } from 'date-fns-tz'
import type { EmployeeSummaryDTO } from '@/types'
import { formatHoursToDisplay } from '@/lib/utils/time'

// ===== 폰트 등록 (한글 깨짐 방지) =====
// data URI 방식으로 변경 — 파일 경로 파싱 오류 방지 (Windows 백슬래시, Edge Runtime 등)
function loadFontDataUri(): string {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansKR-Regular.ttf')
  const buffer = fs.readFileSync(fontPath)
  return `data:font/truetype;base64,${buffer.toString('base64')}`
}

Font.register({
  family: 'NotoSansKR',
  src: loadFontDataUri(),
})

// ===== 날짜별 상세 데이터 타입 (generateReport.ts에서 import하여 사용) =====

// 일별 직원 근무 기록
export interface DailyRecord {
  hours: number   // 근무시간 (WORK=실제, SICK/ANNUAL/HOLIDAY=8h 고정, UNPAID=제외)
  status: string  // 기록 상태 코드
}

// 날짜별 데이터
export interface DayData {
  date: string            // YYYY-MM-DD
  dayOfWeek: number       // 0=일, 1=월, ..., 6=토
  isHoliday: boolean
  holidayName: string | null
  records: Record<string, DailyRecord>  // userId → DailyRecord
}

// DailyGrid 전체 데이터
export interface DailyGridData {
  employees: Array<{ id: string; name: string }>
  days: DayData[]
}

// ===== 컴포넌트 Props 타입 =====
export interface ReportDocumentProps {
  startDate: string           // YYYY-MM-DD
  endDate: string             // YYYY-MM-DD
  summary: EmployeeSummaryDTO[]   // 직원별 집계 (SummaryTable 형식)
  dailyGrid: DailyGridData        // 날짜별 상세 (DailyGrid 형식)
  generatedAt: string         // ISO 8601 생성 시각
}

// ===== 스타일 정의 =====
const styles = StyleSheet.create({
  // ── 페이지 기본 ──
  page: {
    fontFamily: 'NotoSansKR',
    padding: 40,
    paddingTop: 55,
    paddingBottom: 50,
    fontSize: 9,
  },
  // 표지 전용 (페이지 헤더 없음)
  pageNoPadTop: {
    fontFamily: 'NotoSansKR',
    padding: 40,
    paddingBottom: 50,
    fontSize: 9,
  },

  // ── 페이지 헤더 / 푸터 (고정 위치) ──
  pageHeader: {
    position: 'absolute',
    top: 16,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#9CA3AF',
    borderBottom: '0.5pt solid #E5E7EB',
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pageFooter: {
    position: 'absolute',
    bottom: 16,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center',
    borderTop: '0.5pt solid #E5E7EB',
    paddingTop: 4,
  },

  // ── 표지 ──
  coverPage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coverTitle: { fontSize: 24, textAlign: 'center', marginBottom: 8, color: '#1F2937' },
  coverSubtitle: { fontSize: 14, textAlign: 'center', color: '#6B7280', marginBottom: 40 },
  coverMeta: { fontSize: 10, textAlign: 'center', color: '#9CA3AF', marginTop: 8 },
  coverDivider: { width: 80, borderBottom: '2pt solid #1F2937', marginBottom: 24, marginTop: 8 },

  // ── 섹션 제목 ──
  sectionTitle: {
    fontSize: 12,
    marginBottom: 10,
    color: '#1F2937',
    borderBottom: '1pt solid #E5E7EB',
    paddingBottom: 4,
  },

  // ── 테이블 공통 행 ──
  tHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    padding: 5,
  },
  tRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
  },
  tRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
    backgroundColor: '#F9FAFB',
  },
  tRowTotal: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
    backgroundColor: '#F3F4F6',
  },
  // DailyGrid 행 색상
  tRowHoliday: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
    backgroundColor: '#FEF3C7',  // 노랑
  },
  tRowSaturday: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
    backgroundColor: '#EFF6FF',  // 연파랑
  },
  tRowSunday: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
    backgroundColor: '#FEF2F2',  // 연빨강
  },

  // ── 셀 텍스트 ──
  cellText: { fontSize: 8, color: '#374151' },
  cellTextBlue: { fontSize: 8, color: '#1D4ED8' },
  cellTextBold: { fontSize: 8, color: '#1F2937' },
  headerCellText: { fontSize: 8, color: '#FFFFFF' },

  // ── SummaryTable 컬럼 너비 (8컬럼, 합계 100%) ──
  sColName:       { width: '13%' },
  sColWorkDays:   { width: '11%' },
  sColSick:       { width: '10%' },
  sColAnnual:     { width: '10%' },
  sColHoliday:    { width: '10%' },
  sColUnpaid:     { width: '10%' },
  sColWorkHours:  { width: '18%' },
  // 총 근무시간 열: 데이터 셀은 파란 배경
  sColTotal:      { width: '18%' },
  sColTotalData:  { width: '18%', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: 8 },
})

// ===== 유틸 함수 =====

/** YYYY-MM-DD → "YYYY년 MM월 DD일" */
function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${m}월 ${d}일`
}

/** ISO 8601 → NZT(뉴질랜드 표준시) 기준 "YYYY년 MM월 DD일" */
function formatGeneratedAt(isoStr: string): string {
  try {
    return formatInTimeZone(new Date(isoStr), 'Pacific/Auckland', 'yyyy년 MM월 dd일')
  } catch {
    return isoStr.slice(0, 10)
  }
}

/**
 * DailyGrid 시간 표시 — 정수면 정수, 소수면 소수점 1자리
 * web DailyGrid.tsx의 formatHours 함수와 동일 로직
 */
function formatHours(hours: number): string {
  if (Number.isInteger(hours)) return hours.toString()
  return hours.toFixed(1)
}

/**
 * DailyGrid 비고 생성 — web DailyGrid.tsx의 generateRemark 함수와 동일 로직
 * 우선순위: 공휴일명 > 토/일요일 > 특이상태 직원 목록
 */
function generateRemark(
  day: DayData,
  employees: Array<{ id: string; name: string }>
): string {
  // 1. 공휴일 우선
  if (day.isHoliday && day.holidayName) return day.holidayName

  const remarks: string[] = []

  // 2. 토/일요일
  if (day.dayOfWeek === 6) remarks.push('토요일')
  else if (day.dayOfWeek === 0) remarks.push('일요일')

  // 3. 특이 상태 직원 (SICK / ANNUAL / UNPAID)
  const specials = employees
    .filter(emp => {
      const rec = day.records[emp.id]
      return rec && ['SICK', 'ANNUAL', 'UNPAID'].includes(rec.status)
    })
    .map(emp => {
      const status = day.records[emp.id].status
      const label = status === 'SICK' ? '병가' : status === 'ANNUAL' ? '연차' : '무급'
      return `${emp.name} ${label}`
    })

  remarks.push(...specials)
  return remarks.join(', ')
}

// ===== 서브 컴포넌트 =====

/** 페이지 공통 헤더 — 고정 위치 (absolute) */
function PageHeader({ startDate, endDate }: { startDate: string; endDate: string }) {
  return (
    <View style={styles.pageHeader} fixed>
      <Text>JunFire Protection 업무 기록 보고서</Text>
      <Text>{startDate} ~ {endDate}</Text>
    </View>
  )
}

/** 페이지 공통 푸터 (페이지 번호) — 고정 위치 (absolute) */
function PageFooter() {
  return (
    <Text
      style={styles.pageFooter}
      render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `${pageNumber} / ${totalPages}`
      }
      fixed
    />
  )
}

/** 표지 페이지 컴포넌트 */
function CoverPage({
  startDate,
  endDate,
  generatedAt,
}: {
  startDate: string
  endDate: string
  generatedAt: string
}) {
  return (
    <View style={styles.coverPage}>
      <Text style={styles.coverTitle}>JunFire Protection</Text>
      <View style={styles.coverDivider} />
      <Text style={styles.coverSubtitle}>업무 기록 보고서</Text>
      <Text style={styles.coverMeta}>
        {`기간: ${formatDateDisplay(startDate)} ~ ${formatDateDisplay(endDate)}`}
      </Text>
      <Text style={styles.coverMeta}>{`생성일: ${formatGeneratedAt(generatedAt)}`}</Text>
    </View>
  )
}

/**
 * 직원별 집계 테이블 PDF 컴포넌트
 * web SummaryTable.tsx와 동일한 컬럼 구성:
 * 직원 / 정상근무(일) / 병가(일) / 연차(일) / 공휴일(일) / 무급(일) / 정상근무 실시간 / 총 근무시간
 * 직원 2명 이상일 때 하단 합계 행 표시
 */
function PdfSummarySection({ summary }: { summary: EmployeeSummaryDTO[] }) {
  // 합계 계산 (직원 2명 이상일 때 표시)
  const totals = {
    workDays:       summary.reduce((s, r) => s + r.workDays, 0),
    sickDays:       summary.reduce((s, r) => s + r.sickDays, 0),
    annualDays:     summary.reduce((s, r) => s + r.annualDays, 0),
    holidayDays:    summary.reduce((s, r) => s + r.holidayDays, 0),
    unpaidDays:     summary.reduce((s, r) => s + r.unpaidDays, 0),
    workActualHours: Math.round(summary.reduce((s, r) => s + r.workActualHours, 0) * 10) / 10,
    totalHours:      Math.round(summary.reduce((s, r) => s + r.totalHours, 0) * 10) / 10,
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>직원별 집계</Text>

      {/* 헤더 행 */}
      <View style={styles.tHeaderRow}>
        <Text style={[styles.headerCellText, styles.sColName]}>직원</Text>
        <Text style={[styles.headerCellText, styles.sColWorkDays]}>정상근무(일)</Text>
        <Text style={[styles.headerCellText, styles.sColSick]}>병가(일)</Text>
        <Text style={[styles.headerCellText, styles.sColAnnual]}>연차(일)</Text>
        <Text style={[styles.headerCellText, styles.sColHoliday]}>공휴일(일)</Text>
        <Text style={[styles.headerCellText, styles.sColUnpaid]}>무급(일)</Text>
        <Text style={[styles.headerCellText, styles.sColWorkHours]}>정상근무 실시간</Text>
        <Text style={[styles.headerCellText, styles.sColTotal]}>총 근무시간</Text>
      </View>

      {/* 직원별 데이터 행 */}
      {summary.map((row, idx) => {
        const rowStyle = idx % 2 === 1 ? styles.tRowAlt : styles.tRow
        return (
          <View key={row.userId} style={rowStyle}>
            <Text style={[styles.cellText, styles.sColName]}>{row.name}</Text>
            <Text style={[styles.cellText, styles.sColWorkDays]}>
              {row.workDays > 0 ? `${row.workDays}일` : '-'}
            </Text>
            <Text style={[styles.cellText, styles.sColSick]}>
              {row.sickDays > 0 ? `${row.sickDays}일` : '-'}
            </Text>
            <Text style={[styles.cellText, styles.sColAnnual]}>
              {row.annualDays > 0 ? `${row.annualDays}일` : '-'}
            </Text>
            <Text style={[styles.cellText, styles.sColHoliday]}>
              {row.holidayDays > 0 ? `${row.holidayDays}일` : '-'}
            </Text>
            <Text style={[styles.cellText, styles.sColUnpaid]}>
              {row.unpaidDays > 0 ? `${row.unpaidDays}일` : '-'}
            </Text>
            <Text style={[styles.cellText, styles.sColWorkHours]}>
              {row.workActualHours > 0 ? formatHoursToDisplay(row.workActualHours) : '-'}
            </Text>
            {/* 총 근무시간: 파란 배경 + 파란 텍스트 (SummaryTable.tsx bg-blue-50 text-blue-700 동일) */}
            <Text style={styles.sColTotalData}>
              {formatHoursToDisplay(row.totalHours)}
            </Text>
          </View>
        )
      })}

      {/* 합계 행 (직원 2명 이상) */}
      {summary.length > 1 && (
        <View style={styles.tRowTotal}>
          <Text style={[styles.cellTextBold, styles.sColName]}>합계</Text>
          <Text style={[styles.cellTextBold, styles.sColWorkDays]}>{totals.workDays}일</Text>
          <Text style={[styles.cellTextBold, styles.sColSick]}>{totals.sickDays}일</Text>
          <Text style={[styles.cellTextBold, styles.sColAnnual]}>{totals.annualDays}일</Text>
          <Text style={[styles.cellTextBold, styles.sColHoliday]}>{totals.holidayDays}일</Text>
          <Text style={[styles.cellTextBold, styles.sColUnpaid]}>{totals.unpaidDays}일</Text>
          <Text style={[styles.cellTextBold, styles.sColWorkHours]}>
            {formatHoursToDisplay(totals.workActualHours)}
          </Text>
          <Text style={styles.sColTotalData}>{formatHoursToDisplay(totals.totalHours)}</Text>
        </View>
      )}
    </View>
  )
}

/**
 * 날짜별 상세 기록 크로스 테이블 PDF 컴포넌트
 * web DailyGrid.tsx와 동일한 구조:
 * - 열: 근무일 / 직원1 / 직원2 / ... / 비고
 * - 행: 날짜별 (전체 기간)
 * - 하단: 직원별 총 근무시간 합계 행
 * - 행 색상: 공휴일=노랑, 토요일=연파랑, 일요일=연빨강, 교대=흰/연회색
 */
function PdfDailyGridSection({ dailyGrid }: { dailyGrid: DailyGridData }) {
  const { employees, days } = dailyGrid

  // 동적 컬럼 너비 계산 (A4 portrait 기준)
  // 근무일: 14%, 비고: 18%, 나머지를 직원 수로 균등 분배
  const dateColW = '14%'
  const remarkColW = '18%'
  const empRemainingPct = 100 - 14 - 18
  const empColW = employees.length > 0
    ? `${(empRemainingPct / employees.length).toFixed(1)}%`
    : `${empRemainingPct}%`

  // 직원별 합계 시간 계산
  const empTotalHours: Record<string, number> = {}
  employees.forEach(emp => { empTotalHours[emp.id] = 0 })
  days.forEach(day => {
    Object.entries(day.records).forEach(([uid, rec]) => {
      if (empTotalHours[uid] !== undefined) {
        empTotalHours[uid] += rec.hours
      }
    })
  })

  /**
   * 날짜 행 스타일 결정 — DailyGrid.tsx getRowStyle 동일 로직
   * 공휴일 > 토요일 > 일요일 > 짝수/홀수 교대
   */
  function getRowStyle(day: DayData, idx: number) {
    if (day.isHoliday) return styles.tRowHoliday
    if (day.dayOfWeek === 6) return styles.tRowSaturday
    if (day.dayOfWeek === 0) return styles.tRowSunday
    return idx % 2 === 0 ? styles.tRow : styles.tRowAlt
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>날짜별 상세 기록</Text>

      {/* 헤더 행 */}
      <View style={styles.tHeaderRow}>
        <Text style={[styles.headerCellText, { width: dateColW }]}>근무일</Text>
        {employees.map(emp => (
          <Text key={emp.id} style={[styles.headerCellText, { width: empColW }]}>
            {emp.name}
          </Text>
        ))}
        <Text style={[styles.headerCellText, { width: remarkColW }]}>비고</Text>
      </View>

      {/* 날짜별 데이터 행 */}
      {days.map((day, idx) => (
        <View key={day.date} style={getRowStyle(day, idx)}>
          {/* 날짜 셀 (YYYY/MM/DD 형식 — DailyGrid.tsx 동일) */}
          <Text style={[styles.cellText, { width: dateColW }]}>
            {day.date.replace(/-/g, '/')}
          </Text>
          {/* 직원별 근무시간 셀 */}
          {employees.map(emp => {
            const rec = day.records[emp.id]
            return (
              <Text
                key={emp.id}
                style={[styles.cellText, { width: empColW, textAlign: 'center' }]}
              >
                {rec ? formatHours(rec.hours) : '0'}
              </Text>
            )
          })}
          {/* 비고 셀 */}
          <Text style={[styles.cellText, { width: remarkColW, fontSize: 7 }]}>
            {generateRemark(day, employees)}
          </Text>
        </View>
      ))}

      {/* 합계 행 */}
      <View style={styles.tRowTotal}>
        <Text style={[styles.cellTextBold, { width: dateColW }]}>총 근무시간</Text>
        {employees.map(emp => {
          const h = Math.round((empTotalHours[emp.id] ?? 0) * 10) / 10
          return (
            <Text
              key={emp.id}
              style={[styles.cellTextBold, { width: empColW, textAlign: 'center' }]}
            >
              {formatHours(h)}
            </Text>
          )
        })}
        <Text style={{ width: remarkColW }} />
      </View>
    </View>
  )
}

// ===== 메인 문서 컴포넌트 =====

/**
 * JunFire Protection 업무 기록 보고서 PDF 문서 컴포넌트
 *
 * 구조:
 * - 1페이지: 표지 (회사명, 보고서 제목, 기간, 생성일)
 * - 2페이지: 직원별 집계 (SummaryTable.tsx 동일 컬럼 구조)
 * - 3페이지~: 날짜별 상세 기록 (DailyGrid.tsx 동일 크로스 테이블 구조)
 */
export function ReportDocument({
  startDate,
  endDate,
  summary,
  dailyGrid,
  generatedAt,
}: ReportDocumentProps) {
  return (
    <Document
      title={`JunFire Protection 업무 기록 보고서 (${startDate} ~ ${endDate})`}
      author="JunFire Protection"
      creator="JunFire Protection 시스템"
    >
      {/* 1페이지: 표지 (헤더 없음) */}
      <Page size="A4" style={styles.pageNoPadTop}>
        <CoverPage startDate={startDate} endDate={endDate} generatedAt={generatedAt} />
        <PageFooter />
      </Page>

      {/* 2페이지: 직원별 집계 */}
      <Page size="A4" style={styles.page}>
        <PageHeader startDate={startDate} endDate={endDate} />
        <PdfSummarySection summary={summary} />
        <PageFooter />
      </Page>

      {/* 3페이지~: 날짜별 상세 기록 (내용이 많으면 자동 페이지 분리) */}
      <Page size="A4" style={styles.page}>
        <PageHeader startDate={startDate} endDate={endDate} />
        <PdfDailyGridSection dailyGrid={dailyGrid} />
        <PageFooter />
      </Page>
    </Document>
  )
}

/**
 * JSX 컨텍스트에서 PDF 버퍼 생성
 * generateReport.ts (JSX 없는 .ts)에서 React.createElement 직접 호출 시 reconciler 오류 방지
 * — .tsx 파일에서만 JSX transform이 보장됨
 */
export async function renderReportDocument(props: ReportDocumentProps): Promise<Buffer> {
  const pdfBuffer = await renderToBuffer(
    <ReportDocument
      startDate={props.startDate}
      endDate={props.endDate}
      summary={props.summary}
      dailyGrid={props.dailyGrid}
      generatedAt={props.generatedAt}
    />
  )
  return pdfBuffer as Buffer
}
