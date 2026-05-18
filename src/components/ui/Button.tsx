// src/components/ui/Button.tsx
// 목적: 공통 버튼 컴포넌트 — variant, size, 로딩 상태 지원
'use client'

import React from 'react'
import LoadingSpinner from './LoadingSpinner'

// 버튼 variant 타입 — 용도별 색상 구분
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

// 버튼 크기 타입
type ButtonSize = 'sm' | 'md' | 'lg'

// 버튼 props — 기본 button 속성 + 커스텀 속성
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean   // 로딩 중이면 스피너 표시 + 클릭 비활성화
  children: React.ReactNode
}

// variant별 Tailwind 스타일 매핑
const variantStyles: Record<ButtonVariant, string> = {
  primary:   'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-400',
  danger:    'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
  ghost:     'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-300 border border-gray-300',
}

// size별 Tailwind 패딩/폰트 크기 매핑
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}

/**
 * 공통 버튼 컴포넌트
 * - variant: primary(파랑) / secondary(회색) / danger(빨강) / ghost(투명)
 * - isLoading: 로딩 스피너 표시 및 클릭 비활성화
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  // 로딩 중이거나 disabled 상태면 버튼 비활성화
  const isDisabled = disabled || isLoading

  return (
    <button
      disabled={isDisabled}
      className={[
        // 기본 공통 스타일
        'inline-flex items-center justify-center gap-2 font-medium rounded-md',
        'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2',
        // variant 스타일
        variantStyles[variant],
        // size 스타일
        sizeStyles[size],
        // 비활성화 스타일
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className,
      ].join(' ')}
      {...rest}
    >
      {/* 로딩 중이면 스피너 표시 */}
      {isLoading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  )
}
