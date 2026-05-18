// src/components/ui/Toast.tsx
// 목적: 전역 토스트 알림 시스템 — Context API 기반, 3초 자동 소멸
'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

// 토스트 타입 — 성공/에러/정보
type ToastType = 'success' | 'error' | 'info'

// 토스트 아이템 데이터 구조
interface ToastItem {
  id: number          // 고유 ID (중복 방지용)
  type: ToastType
  message: string
}

// 토스트 Context 타입 — showToast 함수만 외부에 노출
interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

// Context 초기값 (Provider 없이 사용 시 경고 방지)
const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
})

// 토스트 타입별 스타일 매핑
const toastStyles: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error:   'bg-red-600 text-white',
  info:    'bg-blue-600 text-white',
}

// 토스트 타입별 아이콘
const toastIcons: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
}

// ID 카운터 — 렌더링과 무관한 전역 카운터
let toastIdCounter = 0

/**
 * 토스트 Provider — 앱 루트에서 감싸야 함
 * children에게 showToast 함수 제공
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  // 현재 표시 중인 토스트 목록
  const [toasts, setToasts] = useState<ToastItem[]>([])

  /**
   * 토스트 표시 함수
   * @param message 표시할 메시지
   * @param type 타입 (기본: 'info')
   */
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastIdCounter
    setToasts((prev) => [...prev, { id, type, message }])

    // 3초 후 자동 제거
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* 토스트 컨테이너 — 화면 우상단 고정 */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={[
              'flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg',
              'text-sm font-medium pointer-events-auto',
              'animate-in slide-in-from-right-5 fade-in duration-200',
              toastStyles[toast.type],
            ].join(' ')}
          >
            {/* 아이콘 */}
            <span className="text-base font-bold" aria-hidden="true">
              {toastIcons[toast.type]}
            </span>
            {/* 메시지 */}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * 토스트 커스텀 훅 — 컴포넌트에서 showToast 사용 시
 * 예: const { showToast } = useToast()
 */
export function useToast(): ToastContextType {
  return useContext(ToastContext)
}

export default ToastProvider
