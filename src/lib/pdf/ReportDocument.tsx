// src/lib/pdf/ReportDocument.tsx — @react-pdf/renderer PDF 문서 정의
// 목적: JunFire Protection 업무 기록 보고서 PDF 레이아웃 컴포넌트
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
import { RoleLabel, StatusLabel } from '@/types'
import { formatHoursToDisplay } from '@/lib/utils/time'
import { getDayOfWeekKo } from '@/lib/utils/date'
import { formatInTimeZone } from 'date-fns-tz'
import type { WorkRecordDTO, Role } from '@/types'
import type { UserReportEntry } from './generateReport'

// ===== 폰트 등록 (한글 깨짐 방지) =====
// [FIX-003] data URI 방식으로 변경 — 파일 경로 파싱 오류 방지 (Windows 백슬래시, Edge Runtime 등)
// Buffer를 base64 인코딩하여 @react-pdf/renderer에 직접 주입 → 경로 의존성 제거
function loadFontDataUri(): string {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansKR-Regular.ttf')
  const buffer = fs.readFileSync(fontPath)
  return `data:font/truetype;base64,${buffer.toString('base64')}`
}

Font.register({
  family: 'NotoSansKR',
  src: loadFontDataUri(),
})

// ===== 상태 한국어 레이블 =====
// StatusLabel을 types/index.ts에서 직접 재사용 (중복 정의 방지)
// HOLIDAY 포함 — 모든 RecordStatus 커버
const STATUS_LABEL: Record<string, string> = {
  WORK: StatusLabel.WORK,
  SICK: StatusLabel.SICK,
  ANNUAL: StatusLabel.ANNUAL,
  UNPAID: StatusLabel.UNPAID,
  HOLIDAY: StatusLabel.HOLIDAY,
}

// ===== 스타일 정의 =====
const styles = StyleSheet.create({
  // 페이지 기본 설정
  page: {
    fontFamily: 'NotoSansKR',
    padding: 40,
    paddingTop: 50,    // 헤더 공간 확보
    paddingBottom: 50, // 푸터 공간 확보
    fontSize: 9,
  },

  // 표지 스타일
  coverPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverTitle: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
    color: '#1F2937',
  },
  coverSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 40,
  },
  coverMeta: {
    fontSize: 10,
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 8,
  },
  coverDivider: {
    width: 80,
    borderBottom: '2pt solid #1F2937',
    marginBottom: 24,
    marginTop: 8,
  },

  // 집계 요약 섹션 스타일
  summaryTitle: {
    fontSize: 12,
    marginBottom: 12,
    color: '#1F2937',
    borderBottom: '1pt solid #E5E7EB',
    paddingBottom: 4,
  },
  summaryTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 5,
  },
  summaryTableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
  },
  summaryTableRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
    backgroundColor: '#F9FAFB',
  },
  summaryHeaderText: {
    color: '#FFFFFF',
    fontSize: 8,
  },

  // 직원 섹션 헤더
  sectionHeader: {
    fontSize: 12,
    backgroundColor: '#F3F4F6',
    padding: 6,
    marginTop: 16,
    marginBottom: 8,
    color: '#1F2937',
  },

  // 집계 행 (직원 헤더 아래 요약)
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  summaryItem: {
    flex: 1,
    fontSize: 9,
    color: '#374151',
    minWidth: 80,
  },
  summaryLabel: {
    color: '#6B7280',
  },
  summaryValue: {
    color: '#1F2937',
  },

  // 상세 테이블 헤더
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 4,
  },
  tableHeaderText: {
    color: '#FFFFFF',
    fontSize: 8,
  },

  // 상세 테이블 행
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 3,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 3,
    backgroundColor: '#F9FAFB',
  },
  tableRowHoliday: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 3,
    backgroundColor: '#FEF3C7',  // 공휴일 행 — 노란 배경
  },

  // 컬럼 너비 — A4 용지 기준 (40pt padding 양쪽)
  colDate: { width: '14%' },
  colDay: { width: '8%' },
  colStatus: { width: '12%' },
  colHours: { width: '12%' },
  colLocation: { width: '18%' },
  colDescription: { width: '36%' },

  // 집계 요약 테이블 컬럼 (공휴일 컬럼 추가로 너비 재배분)
  colSummaryName: { width: '18%' },
  colSummaryRole: { width: '10%' },
  colSummaryWorkDays: { width: '12%' },
  colSummaryWorkHours: { width: '18%' },
  colSummarySick: { width: '10%' },
  colSummaryAnnual: { width: '10%' },
  colSummaryHoliday: { width: '10%' },  // 공휴일 컬럼 신규
  colSummaryUnpaid: { width: '12%' },

  // 페이지 헤더 (고정 위치)
  header: {
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

  // 페이지 푸터 (고정 위치)
  pageNumber: {
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
})

// ===== 컴포넌트 Props 타입 =====

interface ReportDocumentProps {
  startDate: string             // YYYY-MM-DD
  endDate: string               // YYYY-MM-DD
  sortedUsers: UserReportEntry[] // 가나다순 정렬된 직원별 집계
  holidayMap: Map<string, string> // date → 공휴일명 Map
  generatedAt: string           // ISO 8601 생성 시각
}

// ===== 상세 행 타입 =====
interface DetailRow {
  date: string           // YYYY-MM-DD
  dayOfWeek: string      // 요일 (한국어 1글자)
  status: string         // 표시용 상태명
  totalHours: string | null // "X시간 Y분" 형식 또는 null
  location: string | null
  description: string
  isHoliday: boolean
}

// ===== 유틸 함수 =====

/**
 * UTC ISO 8601 시각을 NZT(뉴질랜드 표준시) 기준 HH:mm 표시 형식으로 변환
 * @param isoStr ISO 8601 UTC 문자열
 * @returns "HH:mm" 형식
 */
function formatTimeDisplay(isoStr: string | null): string {
  if (!isoStr) return '-'
  try {
    return formatInTimeZone(new Date(isoStr), 'Pacific/Auckland', 'HH:mm')
  } catch {
    return '-'
  }
}

/**
 * 생성 일시 ISO 문자열을 NZT(뉴질랜드 표준시) 기준 "YYYY년 MM월 DD일" 형식으로 변환
 * @param isoStr ISO 8601 문자열
 * @returns "YYYY년 MM월 DD일" 형식
 */
function formatGeneratedAt(isoStr: string): string {
  try {
    return formatInTimeZone(new Date(isoStr), 'Pacific/Auckland', 'yyyy년 MM월 dd일')
  } catch {
    return isoStr.slice(0, 10)
  }
}

/**
 * YYYY-MM-DD를 "YYYY년 MM월 DD일" 형식으로 변환
 * @param dateStr YYYY-MM-DD
 * @returns "YYYY년 MM월 DD일"
 */
function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${m}월 ${d}일`
}

/**
 * 기록 배열과 공휴일 맵에서 상세 행 배열 구성
 * startDate ~ endDate 전체 날짜 순회 (기록 없는 날도 포함)
 * NF-V2-003: 공휴일 행은 holidayMap에서 조회하여 삽입
 *
 * @param records - 해당 직원의 업무 기록 배열 (YYYY-MM-DD date 필드)
 * @param holidayMap - date(YYYY-MM-DD) → 공휴일명 Map
 * @param startDate - YYYY-MM-DD
 * @param endDate - YYYY-MM-DD
 * @returns 날짜 오름차순 정렬된 DetailRow 배열
 */
function buildDetailRows(
  records: WorkRecordDTO[],
  holidayMap: Map<string, string>,
  startDate: string,
  endDate: string
): DetailRow[] {
  // 날짜 → 기록 Map (빠른 조회용)
  const recordDateMap = new Map<string, WorkRecordDTO>()
  for (const r of records) {
    recordDateMap.set(r.date, r)
  }

  const rows: DetailRow[] = []

  // startDate ~ endDate 전체 날짜 순회
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const current = new Date(start)

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10)
    const dayOfWeek = getDayOfWeekKo(dateStr)
    const isHoliday = holidayMap.has(dateStr)
    const record = recordDateMap.get(dateStr)

    if (record) {
      // 기록 있는 날
      rows.push({
        date: dateStr,
        dayOfWeek,
        status: STATUS_LABEL[record.status] ?? record.status,
        totalHours: record.totalHours != null ? formatHoursToDisplay(record.totalHours) : null,
        location: record.location,
        description: record.description ?? '-',
        isHoliday,
      })
    } else if (isHoliday) {
      // 기록 없는 공휴일 (NF-V2-003)
      const holidayName = holidayMap.get(dateStr)!
      rows.push({
        date: dateStr,
        dayOfWeek,
        status: `공휴일 (${holidayName})`,
        totalHours: null,
        location: null,
        description: '-',
        isHoliday: true,
      })
    }
    // 기록 없는 평일은 표시하지 않음 (상세 테이블 간소화)

    // 하루 증가
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return rows
}

// ===== 서브 컴포넌트 =====

/**
 * 페이지 공통 헤더 — 고정 위치 (absolute)
 */
function PageHeader({ startDate, endDate }: { startDate: string; endDate: string }) {
  return (
    <View style={styles.header} fixed>
      <Text>JunFire Protection 업무 기록 보고서</Text>
      <Text>
        {startDate} ~ {endDate}
      </Text>
    </View>
  )
}

/**
 * 페이지 공통 푸터 (페이지 번호) — 고정 위치 (absolute)
 */
function PageFooter() {
  return (
    <Text
      style={styles.pageNumber}
      render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `${pageNumber} / ${totalPages}`
      }
      fixed
    />
  )
}

/**
 * 표지 페이지 컴포넌트
 */
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
        기간: {formatDateDisplay(startDate)} ~ {formatDateDisplay(endDate)}
      </Text>
      <Text style={styles.coverMeta}>생성일: {formatGeneratedAt(generatedAt)}</Text>
    </View>
  )
}

/**
 * 전직원 집계 요약 테이블 — 2페이지
 */
function SummaryTable({ users }: { users: UserReportEntry[] }) {
  return (
    <View>
      <Text style={styles.summaryTitle}>직원별 집계 요약</Text>

      {/* 테이블 헤더 */}
      <View style={styles.summaryTableHeader}>
        <Text style={[styles.summaryHeaderText, styles.colSummaryName]}>직원명</Text>
        <Text style={[styles.summaryHeaderText, styles.colSummaryRole]}>직책</Text>
        <Text style={[styles.summaryHeaderText, styles.colSummaryWorkDays]}>근무일수</Text>
        <Text style={[styles.summaryHeaderText, styles.colSummaryWorkHours]}>총 근무시간</Text>
        <Text style={[styles.summaryHeaderText, styles.colSummarySick]}>병가</Text>
        <Text style={[styles.summaryHeaderText, styles.colSummaryAnnual]}>연차</Text>
        <Text style={[styles.summaryHeaderText, styles.colSummaryHoliday]}>공휴일</Text>
        <Text style={[styles.summaryHeaderText, styles.colSummaryUnpaid]}>무급</Text>
      </View>

      {/* 테이블 본문 */}
      {users.map((entry, idx) => {
        const isAlt = idx % 2 === 1
        const rowStyle = isAlt ? styles.summaryTableRowAlt : styles.summaryTableRow
        const roleLabel = RoleLabel[entry.user.role] ?? entry.user.role

        return (
          <View key={entry.user.id} style={rowStyle}>
            <Text style={styles.colSummaryName}>{entry.user.name}</Text>
            <Text style={styles.colSummaryRole}>{roleLabel}</Text>
            <Text style={styles.colSummaryWorkDays}>{entry.totalWorkDays}일</Text>
            <Text style={styles.colSummaryWorkHours}>
              {entry.totalWorkHours > 0 ? formatHoursToDisplay(entry.totalWorkHours) : '-'}
            </Text>
            <Text style={styles.colSummarySick}>{entry.sickDays}일</Text>
            <Text style={styles.colSummaryAnnual}>{entry.annualDays}일</Text>
            <Text style={styles.colSummaryHoliday}>{entry.holidayDays}일</Text>
            <Text style={styles.colSummaryUnpaid}>{entry.unpaidDays}일</Text>
          </View>
        )
      })}
    </View>
  )
}

/**
 * 직원별 상세 기록 테이블 컴포넌트
 * startDate ~ endDate 전체 날짜 순회 (buildDetailRows 사용)
 */
function DetailTable({
  records,
  holidayMap,
  startDate,
  endDate,
}: {
  records: WorkRecordDTO[]
  holidayMap: Map<string, string>
  startDate: string
  endDate: string
}) {
  const rows = buildDetailRows(records, holidayMap, startDate, endDate)

  return (
    <View>
      {/* 테이블 헤더 */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.colDate]}>날짜</Text>
        <Text style={[styles.tableHeaderText, styles.colDay]}>요일</Text>
        <Text style={[styles.tableHeaderText, styles.colStatus]}>상태</Text>
        <Text style={[styles.tableHeaderText, styles.colHours]}>근무시간</Text>
        <Text style={[styles.tableHeaderText, styles.colLocation]}>업무장소</Text>
        <Text style={[styles.tableHeaderText, styles.colDescription]}>업무내용</Text>
      </View>

      {/* 기록 없을 때 안내 */}
      {rows.length === 0 && (
        <View style={styles.tableRow}>
          <Text style={{ fontSize: 9, color: '#9CA3AF', padding: 4 }}>
            기간 내 기록이 없습니다.
          </Text>
        </View>
      )}

      {/* 테이블 본문 */}
      {rows.map((row, idx) => {
        // 공휴일 행 → 노란 배경, 짝수 행 → 연회색 배경
        const rowStyle = row.isHoliday
          ? styles.tableRowHoliday
          : idx % 2 === 1
          ? styles.tableRowAlt
          : styles.tableRow

        return (
          <View key={`${row.date}-${idx}`} style={rowStyle}>
            <Text style={styles.colDate}>{row.date}</Text>
            <Text style={styles.colDay}>{row.dayOfWeek}</Text>
            <Text style={styles.colStatus}>{row.status}</Text>
            <Text style={styles.colHours}>{row.totalHours ?? '-'}</Text>
            <Text style={styles.colLocation}>{row.location ?? '-'}</Text>
            <Text style={styles.colDescription}>{row.description}</Text>
          </View>
        )
      })}
    </View>
  )
}

/**
 * 직원 섹션 헤더 + 집계 요약 행 컴포넌트
 */
function UserSectionHeader({ entry }: { entry: UserReportEntry }) {
  const roleLabel = RoleLabel[entry.user.role] ?? entry.user.role

  return (
    <View>
      {/* 직원 이름 + 직책 */}
      <Text style={styles.sectionHeader}>
        {entry.user.name} ({roleLabel})
      </Text>

      {/* 집계 요약 행 — nested <Text> 완전 제거 (react-pdf v3 React error #31 방지) */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{`총 근무일: ${entry.totalWorkDays}일`}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{`총 근무시간: ${entry.totalWorkHours > 0 ? formatHoursToDisplay(entry.totalWorkHours) : '-'}`}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{`병가: ${entry.sickDays}일`}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{`연차: ${entry.annualDays}일`}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{`무급: ${entry.unpaidDays}일`}</Text>
        </View>
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
 * - 2페이지: 전직원 집계 요약 테이블 (가나다순)
 * - 3페이지~: 직원별 상세 기록 테이블 (직원당 새 페이지)
 */
export function ReportDocument({
  startDate,
  endDate,
  sortedUsers,
  holidayMap,
  generatedAt,
}: ReportDocumentProps) {
  return (
    <Document
      title={`JunFire Protection 업무 기록 보고서 (${startDate} ~ ${endDate})`}
      author="JunFire Protection"
      creator="JunFire Protection 시스템"
    >
      {/* 1페이지: 표지 (헤더/푸터 없음) */}
      <Page size="A4" style={{ ...styles.page, paddingTop: 40 }}>
        <CoverPage
          startDate={startDate}
          endDate={endDate}
          generatedAt={generatedAt}
        />
        <PageFooter />
      </Page>

      {/* 2페이지: 전직원 집계 요약 */}
      <Page size="A4" style={styles.page}>
        <PageHeader startDate={startDate} endDate={endDate} />
        <SummaryTable users={sortedUsers} />
        <PageFooter />
      </Page>

      {/* 3페이지~: 직원별 상세 기록 (직원당 새 페이지) */}
      {sortedUsers.map(entry => (
        <Page key={entry.user.id} size="A4" style={styles.page}>
          <PageHeader startDate={startDate} endDate={endDate} />
          <UserSectionHeader entry={entry} />
          <DetailTable
            records={entry.records}
            holidayMap={holidayMap}
            startDate={startDate}
            endDate={endDate}
          />
          <PageFooter />
        </Page>
      ))}
    </Document>
  )
}

/**
 * JSX 컨텍스트에서 PDF 버퍼 생성 — .tsx 파일에서 호출해야 React element 타입 정합성 보장
 * generateReport.ts (JSX 없는 .ts)에서 React.createElement 직접 호출 시 reconciler 오류 방지
 */
export async function renderReportDocument(props: ReportDocumentProps): Promise<Buffer> {
  const pdfBuffer = await renderToBuffer(
    <ReportDocument
      startDate={props.startDate}
      endDate={props.endDate}
      sortedUsers={props.sortedUsers}
      holidayMap={props.holidayMap}
      generatedAt={props.generatedAt}
    />
  )
  return pdfBuffer as Buffer
}
