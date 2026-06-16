// src/components/admin/StaffTable.tsx
// 목적: 관리자 직원 목록 테이블 — cursor 기반 Load More 페이징
'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserDTO } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

interface StaffTableProps {
  onRegisterClick: () => void    // 직원 등록 버튼 클릭 핸들러
  refreshTrigger?: number        // 이 값이 바뀌면 목록 새로고침
}

/**
 * 직원 목록 테이블 컴포넌트
 * - cursor 기반 Load More 페이징 (take: 20)
 * - 비활성화/재활성화 버튼
 * - 비활성화 직원은 흐린 색상으로 표시
 */
export default function StaffTable({ onRegisterClick, refreshTrigger = 0 }: StaffTableProps) {
  const { showToast } = useToast()

  // 직원 목록 상태
  const [staff, setStaff] = useState<UserDTO[]>([])
  // 다음 cursor (null이면 마지막 페이지)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  // 추가 데이터 있는지 여부
  const [hasMore, setHasMore] = useState(false)
  // 초기 로딩 중
  const [isLoading, setIsLoading] = useState(true)
  // Load More 로딩 중
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // 비활성화 확인 모달 상태
  const [toggleTarget, setToggleTarget] = useState<UserDTO | null>(null)
  const [isToggling, setIsToggling] = useState(false)

  // 비밀번호 리셋 모달 상태
  const [resetTarget, setResetTarget] = useState<UserDTO | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  // 리셋 완료 후 임시 비밀번호 표시용
  const [resetDonePassword, setResetDonePassword] = useState<string | null>(null)

  // 목록 로드 함수 — cursor가 null이면 처음부터 로드
  const loadStaff = useCallback(async (cursor: string | null, isFirst: boolean) => {
    if (isFirst) setIsLoading(true)
    else setIsLoadingMore(true)

    try {
      const params = new URLSearchParams({ take: '20' })
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/admin/staff?${params}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '직원 목록 조회에 실패했습니다.', 'error')
        return
      }

      if (isFirst) {
        setStaff(json.data)
      } else {
        setStaff((prev) => [...prev, ...json.data])
      }
      setNextCursor(json.nextCursor)
      setHasMore(json.hasMore)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      if (isFirst) setIsLoading(false)
      else setIsLoadingMore(false)
    }
  }, [showToast])

  // 컴포넌트 마운트 및 refreshTrigger 변경 시 목록 새로고침
  useEffect(() => {
    loadStaff(null, true)
  }, [loadStaff, refreshTrigger])

  // 비활성화/재활성화 처리
  async function handleToggleActive() {
    if (!toggleTarget) return
    setIsToggling(true)

    try {
      const res = await fetch(`/api/admin/staff/${toggleTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !toggleTarget.isActive }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '처리에 실패했습니다.', 'error')
        return
      }

      const action = toggleTarget.isActive ? '비활성화' : '재활성화'
      showToast(`${toggleTarget.name} 직원이 ${action}되었습니다.`, 'success')
      setToggleTarget(null)
      // 목록 새로고침
      loadStaff(null, true)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsToggling(false)
    }
  }

  // 비밀번호 리셋 처리
  async function handleResetPassword() {
    if (!resetTarget) return
    if (!tempPassword || tempPassword.length < 4) return

    setIsResetting(true)
    try {
      const res = await fetch(`/api/admin/staff/${resetTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', tempPassword }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '비밀번호 초기화에 실패했습니다.', 'error')
        return
      }

      // 성공 — 임시 비밀번호 표시 상태로 전환
      setResetDonePassword(json.tempPassword)
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsResetting(false)
    }
  }

  // 비밀번호 리셋 모달 닫기 + 상태 초기화
  function closeResetModal() {
    setResetTarget(null)
    setTempPassword('')
    setResetDonePassword(null)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      {/* 헤더 영역 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          직원 목록 <span className="text-sm text-gray-500 font-normal">({staff.length}명)</span>
        </h2>
        <Button variant="primary" size="sm" onClick={onRegisterClick}>
          직원 등록
        </Button>
      </div>

      {/* 직원 테이블 */}
      {staff.length === 0 ? (
        <p className="text-center text-gray-400 py-8">등록된 직원이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">이름</th>
                <th className="px-4 py-3 text-left font-medium">아이디</th>
                <th className="px-4 py-3 text-left font-medium">역할</th>
                <th className="px-4 py-3 text-left font-medium">상태</th>
                <th className="px-4 py-3 text-left font-medium">등록일</th>
                <th className="px-4 py-3 text-left font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map((user) => (
                <tr
                  key={user.id}
                  className={[
                    'hover:bg-gray-50 transition-colors',
                    !user.isActive ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.username}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.role === 'ADMIN' ? '관리자' : '직원'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={[
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      user.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500',
                    ].join(' ')}>
                      {user.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant={user.isActive ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => setToggleTarget(user)}
                      >
                        {user.isActive ? '비활성화' : '재활성화'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setResetTarget(user)
                          setTempPassword('')
                          setResetDonePassword(null)
                        }}
                      >
                        비밀번호 초기화
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load More 버튼 */}
      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button
            variant="secondary"
            onClick={() => loadStaff(nextCursor, false)}
            isLoading={isLoadingMore}
          >
            더 보기
          </Button>
        </div>
      )}

      {/* 비밀번호 초기화 모달 */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          onClick={closeResetModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {resetDonePassword ? (
              // 초기화 완료 — 임시 비밀번호 표시
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">초기화 완료</h2>
                <p className="text-sm text-gray-600 mb-3">
                  <span className="font-medium">{resetTarget.name}</span> 직원의 임시 비밀번호:
                </p>
                <div className="bg-gray-100 rounded-md px-4 py-3 text-center font-mono text-lg font-bold text-gray-800 mb-4 select-all">
                  {resetDonePassword}
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  직원에게 이 비밀번호를 전달하세요. 다음 로그인 시 반드시 변경해야 합니다.
                </p>
                <div className="flex justify-end">
                  <Button variant="primary" size="sm" onClick={closeResetModal}>
                    확인
                  </Button>
                </div>
              </>
            ) : (
              // 임시 비밀번호 입력 폼
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">비밀번호 초기화</h2>
                <p className="text-sm text-gray-600 mb-4">
                  <span className="font-medium">{resetTarget.name}</span> 직원의 임시 비밀번호를 설정합니다.
                </p>
                <Input
                  label="임시 비밀번호 (4자 이상)"
                  type="text"
                  placeholder="임시 비밀번호 입력"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  disabled={isResetting}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <Button variant="secondary" size="sm" onClick={closeResetModal} disabled={isResetting}>
                    취소
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleResetPassword}
                    isLoading={isResetting}
                    disabled={tempPassword.length < 4}
                  >
                    초기화
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 비활성화/재활성화 확인 모달 */}
      {toggleTarget && (
        <Modal
          isOpen={true}
          onClose={() => setToggleTarget(null)}
          onConfirm={handleToggleActive}
          title={toggleTarget.isActive ? '직원 비활성화' : '직원 재활성화'}
          message={
            toggleTarget.isActive
              ? `${toggleTarget.name} 직원을 비활성화하시겠습니까? 비활성화된 계정은 로그인할 수 없습니다.`
              : `${toggleTarget.name} 직원을 재활성화하시겠습니까?`
          }
          confirmText={toggleTarget.isActive ? '비활성화' : '재활성화'}
          isLoading={isToggling}
          variant={toggleTarget.isActive ? 'danger' : 'default'}
        />
      )}
    </div>
  )
}
