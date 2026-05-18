// ecosystem.config.js — PM2 프로세스 매니저 설정
// 목적: JunFire Protection Next.js 14 standalone 빌드 PM2 실행 구성
// 소규모 5명 운영 — 단일 인스턴스, 메모리 제한 1G

module.exports = {
  apps: [
    {
      // 프로세스 이름 — pm2 status, pm2 restart, pm2 logs 명령에서 사용
      name: 'junfire',

      // Next.js standalone 빌드 서버 진입점
      // 빌드 후 반드시 다음 복사 명령 실행:
      //   cp -r public .next/standalone/public
      //   cp -r .next/static .next/standalone/.next/static
      script: '.next/standalone/server.js',

      // 실제 배포 경로로 변경 필요 (예: /opt/junfire)
      cwd: '/opt/junfire',

      // 소규모 5명 운영 — 단일 인스턴스 충분
      // 향후 인원 확장 시 cluster 모드로 변경 검토
      instances: 1,

      // 프로세스 비정상 종료 시 자동 재시작
      autorestart: true,

      // 파일 변경 감지 비활성화 — 운영 환경에서 불필요
      watch: false,

      // 메모리 1GB 초과 시 자동 재시작 (메모리 누수 방지)
      max_memory_restart: '1G',

      // [M-008] .env 파일 경로 명시
      // Next.js standalone 빌드는 .env를 자동 로드하지 않으므로 PM2에서 명시적 주입 필수
      // DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL 포함
      env_file: '.env',

      // 운영 환경 변수 (env_file과 병합됨)
      env: {
        NODE_ENV: 'production',
        PORT: 9955,
        HOSTNAME: '0.0.0.0',
      },

      // PM2 로그 파일 경로
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',

      // 로그 날짜 형식
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // PDF 생성 중 강제 종료 방지 — SIGTERM 후 10초 대기
      kill_timeout: 10000,

      // 서버 준비 신호(ready) 수신 대기 활성화
      wait_ready: true,

      // ready 신호 수신 타임아웃 (10초)
      listen_timeout: 10000,
    },
  ],
}
