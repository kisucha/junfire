// src/lib/utils/pagination.ts
// 목적: cursor 기반 페이징 유틸 함수 — 모든 목록 API에서 공통 사용
// [M-002] 범용 CursorQueryOptions — orderBy 필드와 cursor 필드를 분리 지원
// ⛔ offset 페이징 절대 금지 — 이 파일의 함수만 사용할 것

import type { CursorPaginationResult } from '@/types'

/**
 * [M-002] 범용 cursor 쿼리 옵션 인터페이스
 * - cursor: 마지막으로 조회된 레코드의 cursorField 값
 * - take: 가져올 건수
 * - orderBy: Prisma orderBy 형식 (단일 또는 배열)
 * - cursorField: cursor 기준 필드명 (기본값 'id')
 *
 * 사용 예시:
 * - staff API: orderBy: { name: 'asc' }, cursorField: 'id'
 * - admin/records: orderBy: [{ date: 'desc' }, { userId: 'asc' }], cursorField: 'id'
 *
 * 주의: Prisma cursor 페이징은 orderBy와 cursor 필드가 일치해야 완전 정확하다.
 * 소규모(5명 x 근무일수) 환경에서 id cursor + 충분한 take 크기로 실용적 허용.
 * staff(5명 전체)는 take: 100으로 1회 전체 로드하여 cursor 비호환 문제 우회.
 */
export interface CursorQueryOptions {
  cursor?: string                                                          // 이전 페이지 마지막 레코드 id
  take: number                                                             // 가져올 건수
  orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[]  // Prisma orderBy
  cursorField?: string                                                     // cursor 기준 필드 (기본값 'id')
}

/**
 * Prisma findMany에 전달할 cursor 페이징 옵션 생성
 * - take: take+1 (hasMore 판단을 위해 1개 더 조회)
 * - cursor 있으면 skip:1 + cursor 조건 추가 (cursor 레코드 자체 제외)
 * @param options CursorQueryOptions
 * @returns Prisma findMany의 take/skip/cursor 옵션 객체
 */
export function buildCursorQuery(options: CursorQueryOptions) {
  const { cursor, take, cursorField = 'id' } = options

  return {
    take: take + 1, // hasMore 판단용 +1 조회 — 응답 시 slice(0, take)로 제거
    ...(cursor
      ? {
          skip: 1,                              // cursor 레코드 자체는 결과에서 제외
          cursor: { [cursorField]: cursor },    // cursor 필드 기준 페이지 시작점
        }
      : {}),
  }
}

/**
 * Prisma 조회 결과를 CursorPaginationResult로 변환
 * - items.length > take이면 hasMore=true, 마지막 레코드 id를 nextCursor로 반환
 * - items.length <= take이면 hasMore=false, nextCursor=null (마지막 페이지)
 * @param items Prisma findMany 결과 배열 (take+1 개)
 * @param take 원래 요청한 take 수
 * @returns CursorPaginationResult<T>
 */
export function buildCursorResult<T extends { id: string }>(
  items: T[],
  take: number
): CursorPaginationResult<T> {
  // take+1 조회 결과에서 hasMore 판단
  const hasMore = items.length > take

  // 실제 반환할 데이터 — hasMore이면 마지막 1개 제거
  const data = hasMore ? items.slice(0, take) : items

  // 다음 페이지 cursor — 현재 페이지 마지막 레코드의 id
  const nextCursor = hasMore ? data[data.length - 1].id : null

  return { data, nextCursor, hasMore }
}
