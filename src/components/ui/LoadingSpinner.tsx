// src/components/ui/LoadingSpinner.tsx
// 목적: 공통 로딩 스피너 — animate-spin Tailwind 애니메이션 기반
'use client'

// 스피너 크기 타입
type SpinnerSize = 'sm' | 'md' | 'lg'

interface LoadingSpinnerProps {
  size?: SpinnerSize
  className?: string
}

// size별 Tailwind 크기 매핑
const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-4',
}

/**
 * 공통 로딩 스피너 컴포넌트
 * - Tailwind animate-spin 사용
 * - size: sm / md / lg
 */
export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="로딩 중"
      className={[
        'inline-block rounded-full border-gray-300 border-t-blue-600 animate-spin',
        sizeStyles[size],
        className,
      ].join(' ')}
    />
  )
}
