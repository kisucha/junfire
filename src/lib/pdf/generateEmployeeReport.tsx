// src/lib/pdf/generateEmployeeReport.tsx
// 목적: 직원 개인 업무내용 확인서 PDF 생성 — 기간별 업무 기록 테이블 + 총 근무시간 합계
// 서버사이드 전용 — 클라이언트 컴포넌트에서 import 금지

import React from 'react'
import fs from 'fs'
import path from 'path'
import {
  Document,
  Page,
  Text,
  View,
  Font,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import { formatInTimeZone } from 'date-fns-tz'
import type { WorkRecordDTO, RecordStatus } from '@/types'
import { StatusLabel } from '@/types'
import { formatHoursToDisplay } from '@/lib/utils/time'

// ===== 폰트 등록 (한글 깨짐 방지) =====
function loadFontDataUri(): string {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansKR-Regular.ttf')
  const buffer = fs.readFileSync(fontPath)
  return `data:font/truetype;base64,${buffer.toString('base64')}`
}

Font.register({ family: 'NotoSansKR', src: loadFontDataUri() })

// ===== 타입 정의 =====

// 직원 업무내용 확인서 PDF 생성 입력 타입
export interface EmployeeReportInput {
  employeeName: string
  startDate: string     // YYYY-MM-DD
  endDate: string       // YYYY-MM-DD
  records: WorkRecordDTO[]
  totalHoursSum: number
}

// ===== 유틸 함수 =====

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** YYYY-MM-DD → "YYYY년 MM월 DD일" */
function toKoreanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${m}월 ${d}일`
}

/** YYYY-MM-DD → "YYYY/MM/DD (요일)" */
function toShortDateWithDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return `${y}/${m}/${d} (${DAY_KO[dow]})`
}

/** 상태별 근무시간 표시 — WORK=실제시간, SICK/ANNUAL/HOLIDAY=8시간 고정, UNPAID=- */
function getHoursDisplay(record: WorkRecordDTO): string {
  if (record.status === 'WORK') {
    return record.totalHours != null ? formatHoursToDisplay(record.totalHours) : '-'
  }
  if (
    record.status === 'SICK' ||
    record.status === 'ANNUAL' ||
    record.status === 'HOLIDAY'
  ) {
    return '8시간 (고정)'
  }
  return '-'
}

/** ISO 8601 → NZT 기준 출력일 "YYYY년 MM월 DD일" */
function formatPrintDate(isoStr: string): string {
  try {
    return formatInTimeZone(new Date(isoStr), 'Pacific/Auckland', 'yyyy년 MM월 dd일')
  } catch {
    return isoStr.slice(0, 10)
  }
}

// ===== 스타일 정의 =====
const styles = StyleSheet.create({
  // ── 페이지 기본 ──
  page: {
    fontFamily: 'NotoSansKR',
    padding: 40,
    paddingTop: 50,
    paddingBottom: 50,
    fontSize: 9,
  },

  // ── 헤더 섹션 (회사명 + 메타정보) ──
  headerSection: {
    marginBottom: 20,
    borderBottom: '2pt solid #1F2937',
    paddingBottom: 14,
  },
  companyName: {
    fontSize: 20,
    color: '#1F2937',
    marginBottom: 4,
  },
  reportTitle: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: '#6B7280',
    width: '16%',
  },
  metaValue: {
    fontSize: 9,
    color: '#1F2937',
  },

  // ── 테이블 공통 ──
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    padding: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
    minHeight: 18,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E5E7EB',
    padding: 4,
    backgroundColor: '#F9FAFB',
    minHeight: 18,
  },
  tableFooterRow: {
    flexDirection: 'row',
    borderTop: '1.5pt solid #374151',
    padding: 5,
    backgroundColor: '#F3F4F6',
    marginTop: 1,
  },

  // ── 셀 텍스트 ──
  headerCell: { fontSize: 8, color: '#FFFFFF' },
  cell: { fontSize: 8, color: '#374151' },
  cellBold: { fontSize: 8, color: '#1F2937' },

  // ── 컬럼 너비 (A4 portrait 기준) ──
  colDate:     { width: '18%' },
  colStatus:   { width: '12%' },
  colHours:    { width: '14%' },
  colLocation: { width: '15%' },
  colDesc:     { width: '41%' },

  // ── 하단 안내 + 페이지 번호 ──
  footerNote: {
    marginTop: 10,
    fontSize: 7.5,
    color: '#9CA3AF',
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
})

// ===== PDF 문서 컴포넌트 =====

// 직원 업무내용 확인서 — 헤더 + 테이블 + 합계 행 + 안내 문구
function EmployeeReportDocument({
  employeeName,
  startDate,
  endDate,
  records,
  totalHoursSum,
}: EmployeeReportInput) {
  const printedAt = formatPrintDate(new Date().toISOString())

  return (
    <Document
      title={`JunFire Protection 업무 기록 확인서 (${employeeName} / ${startDate} ~ ${endDate})`}
      author="JunFire Protection"
      creator="JunFire Protection 시스템"
    >
      <Page size="A4" style={styles.page}>
        {/* 헤더: 회사명 + 메타정보 */}
        <View style={styles.headerSection}>
          <Text style={styles.companyName}>JunFire Protection</Text>
          <Text style={styles.reportTitle}>업무 기록 확인서</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>직원명</Text>
            <Text style={styles.metaValue}>{employeeName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>조회 기간</Text>
            <Text style={styles.metaValue}>
              {toKoreanDate(startDate)} ~ {toKoreanDate(endDate)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>출력일</Text>
            <Text style={styles.metaValue}>{printedAt}</Text>
          </View>
        </View>

        {/* 테이블 헤더 */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.headerCell, styles.colDate]}>날짜</Text>
          <Text style={[styles.headerCell, styles.colStatus]}>업무상태</Text>
          <Text style={[styles.headerCell, styles.colHours]}>근무시간</Text>
          <Text style={[styles.headerCell, styles.colLocation]}>업무현장</Text>
          <Text style={[styles.headerCell, styles.colDesc]}>업무내용</Text>
        </View>

        {/* 데이터 행 */}
        {records.map((record, idx) => {
          const rowStyle = idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt
          return (
            <View key={record.id} style={rowStyle}>
              <Text style={[styles.cell, styles.colDate]}>
                {toShortDateWithDay(record.date.slice(0, 10))}
              </Text>
              <Text style={[styles.cell, styles.colStatus]}>
                {StatusLabel[record.status as RecordStatus]}
              </Text>
              <Text style={[styles.cell, styles.colHours]}>
                {getHoursDisplay(record)}
              </Text>
              <Text style={[styles.cell, styles.colLocation]}>
                {record.location ?? '-'}
              </Text>
              <Text style={[styles.cell, styles.colDesc]}>
                {record.description ?? '-'}
              </Text>
            </View>
          )
        })}

        {/* 합계 행 */}
        <View style={styles.tableFooterRow}>
          <Text style={[styles.cellBold, styles.colDate]}>
            총 {records.length}건
          </Text>
          <Text style={[styles.cellBold, styles.colStatus]} />
          <Text style={[styles.cellBold, styles.colHours]}>
            {formatHoursToDisplay(totalHoursSum)}
          </Text>
          <Text style={{ width: '56%' }} />
        </View>

        {/* 집계 안내 문구 */}
        <Text style={styles.footerNote}>
          * 병가·연차·공휴일은 8시간으로 집계됩니다. 무급휴가는 집계에서 제외됩니다.
        </Text>

        {/* 페이지 번호 */}
        <Text
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}

// ===== PDF 렌더링 함수 (API Route에서 호출) =====

/**
 * 직원 개인 업무내용 확인서 PDF Buffer 반환
 * Next.js API Route (서버사이드)에서만 호출 가능
 */
export async function generateEmployeeReportPDF(input: EmployeeReportInput): Promise<Buffer> {
  const pdfBuffer = await renderToBuffer(
    <EmployeeReportDocument
      employeeName={input.employeeName}
      startDate={input.startDate}
      endDate={input.endDate}
      records={input.records}
      totalHoursSum={input.totalHoursSum}
    />
  )
  return pdfBuffer as Buffer
}
