// next.config.js — Next.js 16 설정
// PM2 standalone 빌드, @react-pdf/renderer 서버 전용 패키지 등록, PDF API 타임아웃 설정

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PM2 배포를 위한 standalone 빌드 — .next/standalone/server.js 직접 실행 가능
  output: 'standalone',

  // @react-pdf/renderer는 Node.js 서버 전용 모듈 — 클라이언트 번들 제외 필수
  // Next.js 15+: experimental.serverComponentsExternalPackages → serverExternalPackages 로 이동
  serverExternalPackages: ['@react-pdf/renderer'],

  // PDF 생성 API Route 타임아웃 설정 (대용량 보고서 대비 60초)
  async headers() {
    return [
      {
        source: '/api/admin/report',
        headers: [
          {
            key: 'X-Accel-Buffering',
            value: 'no',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
