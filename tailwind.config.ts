// tailwind.config.ts — Tailwind CSS 설정
// JunFire Protection 달력 상태 색상 커스텀 팔레트 포함 (RESEARCH.md 정의 준수)

import type { Config } from 'tailwindcss'

const config: Config = {
  // Tailwind가 클래스를 스캔할 파일 경로 — App Router 구조 대응
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 달력 상태 색상 — RESEARCH.md 정의 준수
        // 각 상태별 배경색 및 텍스트 색상에 활용
        'status-work':      '#22C55E',  // 정상근무 (초록) — 출근 완료 날짜
        'status-no-record': '#EF4444',  // 미입력 (빨강) — 기록 없는 과거 날짜
        'status-sick':      '#EAB308',  // 병가 (노랑) — 병가 처리 날짜
        'status-annual':    '#3B82F6',  // 연차 (파랑) — 연차 사용 날짜
        'status-unpaid':    '#6B7280',  // 무급 (회색) — 무급 처리 날짜
        'status-holiday':   '#8B5CF6',  // 공휴일 (보라) — Holiday 테이블 등록 날짜
      },
    },
  },
  plugins: [],
}

export default config
