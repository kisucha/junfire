#!/bin/bash
# scripts/deploy.sh
# 목적: JunFire Protection 업데이트 배포 스크립트 (git pull → 빌드 → PM2 재시작)
# 실행: bash /opt/junfire/scripts/deploy.sh
# 전제조건: setup.sh 완료 후 사용

set -e  # 오류 발생 시 즉시 중단

APP_DIR="/opt/junfire"

echo "======================================"
echo " JunFire Protection 배포 시작"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"

cd "$APP_DIR"

# 1. 최신 코드 pull
echo "[1/6] git pull..."
git pull origin master

# 2. 의존성 업데이트 (package-lock.json 변경 시에만 실질적으로 재설치)
echo "[2/6] npm 패키지 동기화..."
npm ci

# 3. DB 마이그레이션 (신규 마이그레이션 있으면 적용, 없으면 skip)
echo "[3/6] Prisma 마이그레이션..."
npx prisma migrate deploy

# 4. Next.js 빌드
echo "[4/6] Next.js 빌드..."
npm run build

# 5. standalone 정적 파일 복사
echo "[5/6] 정적 파일 복사..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# 6. PM2 재시작 (무중단 -- update-env 적용)
echo "[6/6] PM2 재시작..."
pm2 startOrRestart ecosystem.config.js --update-env

echo ""
echo "======================================"
echo " 배포 완료! $(date '+%Y-%m-%d %H:%M:%S')"
echo " 상태 확인: pm2 status"
echo " 로그 확인: pm2 logs junfire --lines 50"
echo "======================================"
