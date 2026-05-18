// src/components/ui/Modal.tsx
// 목적: 공통 확인/취소 모달 컴포넌트 — 삭제 확인, 중요 작업 전 사용자 확인
'use client'

import Button from './Button'

interface ModalProps {
  isOpen: boolean           // 모달 표시 여부
  onClose: () => void       // 취소 버튼 / 배경 클릭 시 호출
  onConfirm: () => void     // 확인 버튼 클릭 시 호출
  title: string             // 모달 제목
  message: string           // 모달 본문 메시지
  confirmText?: string      // 확인 버튼 텍스트 (기본: "확인")
  cancelText?: string       // 취소 버튼 텍스트 (기본: "취소")
  isLoading?: boolean       // 확인 버튼 로딩 상태
  variant?: 'default' | 'danger'  // danger: 확인 버튼 빨간색
}

/**
 * 공통 확인 모달 컴포넌트
 * - isOpen: true 이면 화면에 표시
 * - 배경 클릭 또는 취소 버튼으로 닫기
 * - variant='danger': 삭제 등 위험 작업용 빨간 확인 버튼
 */
export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  isLoading = false,
  variant = 'default',
}: ModalProps) {
  // 닫힌 상태면 아무것도 렌더링하지 않음
  if (!isOpen) return null

  return (
    // 반투명 배경 오버레이
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      {/* 모달 패널 — 클릭 이벤트 전파 차단 */}
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 제목 */}
        <h2
          id="modal-title"
          className="text-lg font-semibold text-gray-900 mb-2"
        >
          {title}
        </h2>

        {/* 본문 메시지 */}
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          {message}
        </p>

        {/* 버튼 영역 */}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
