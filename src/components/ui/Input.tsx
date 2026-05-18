// src/components/ui/Input.tsx
// 목적: 공통 인풋 컴포넌트 — 레이블, 에러 메시지 내장
'use client'

import React, { forwardRef } from 'react'

// 지원 input type 목록
type InputType = 'text' | 'email' | 'password' | 'time' | 'date'

// Input props — HTMLInputElement 기본 속성 + 커스텀 속성
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string      // 한국어 레이블 (위에 표시)
  error?: string      // 에러 메시지 (아래에 빨간색 표시)
  type?: InputType
}

/**
 * 공통 인풋 컴포넌트
 * - label: 인풋 위 한국어 레이블
 * - error: 에러 메시지 (빨간 테두리 + 에러 텍스트)
 * - HTMLInputElement props 그대로 전달 (value, onChange 등)
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, type = 'text', className = '', id, ...rest }, ref) => {
    // id가 없으면 label 기반으로 자동 생성 (접근성)
    const inputId = id ?? (label ? `input-${label.replace(/\s+/g, '-')}` : undefined)

    return (
      <div className="flex flex-col gap-1">
        {/* 레이블 */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}

        {/* 인풋 필드 */}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={[
            'w-full rounded-md border px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'transition-colors duration-150',
            // 에러 여부에 따라 테두리/포커스 링 색상 변경
            error
              ? 'border-red-400 focus:ring-red-400 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500 bg-white',
            // disabled 스타일
            rest.disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400' : '',
            className,
          ].join(' ')}
          {...rest}
        />

        {/* 에러 메시지 */}
        {error && (
          <span className="text-xs text-red-500" role="alert">
            {error}
          </span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
