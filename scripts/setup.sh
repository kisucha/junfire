#!/bin/bash
# scripts/setup.sh
# 목적: JunFire Protection 최초 서버 설치 스크립트
# 실행: sudo bash /tmp/setup.sh
# 전제조건: Node.js 18+, npm, PM2, Nginx, MySQL/MariaDB 설치 완료

set -e  # 오류 발생 시 즉시 중단

APP_DIR="/opt/junfire"
REPO_URL="https://github.com/kisucha/junfire.git"

echo "======================================"
echo " JunFire Protection 최초 설치 시작"
echo "======================================"

# 1. 앱 디렉토리 생성
echo "[1/8] 디렉토리 생성: $APP_DIR"
mkdir -p "$APP_DIR"

# 2. git clone
echo "[2/8] 저장소 클론..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  이미 클론된 저장소 — git pull로 대체"
  cd "$APP_DIR"
  git pull origin master
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# 3. .env 파일 확인
echo "[3/8] 환경변수 파일 확인..."
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo ""
  echo "  ⚠️  .env 파일을 편집한 뒤 다시 실행하세요."
  echo "  편집 명령: nano $APP_DIR/.env"
  echo ""
  echo "  필수 항목:"
  echo "    DATABASE_URL=mysql://유저:비밀번호@localhost:3306/junfire"
  echo "    NEXTAUTH_SECRET=랜덤32자이상문자열"
  echo "    NEXTAUTH_URL=http://서버IP또는도메인"
  echo ""
  exit 1
fi

# 4. 의존성 설치
echo "[4/8] npm 패키지 설치..."
npm ci

# 5. DB 마이그레이션
echo "[5/8] Prisma 마이그레이션..."
npx prisma migrate deploy

# 6. Next.js 빌드
echo "[6/8] Next.js 빌드 (standalone)..."
npm run build

# 7. standalone 정적 파일 복사
echo "[7/8] 정적 파일 복사..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
mkdir -p logs

# 8. PM2 시작
echo "[8/8] PM2 프로세스 시작..."
pm2 startOrRestart ecosystem.config.js --update-env
pm2 save

echo ""
echo "======================================"
echo " 설치 완료!"
echo " PM2 상태: pm2 status"
echo " 로그 확인: pm2 logs junfire"
echo ""
echo " Nginx 설정은 nginx.conf 참고:"
echo "   sudo cp $APP_DIR/nginx.conf /etc/nginx/sites-available/junfire"
echo "   sudo ln -s /etc/nginx/sites-available/junfire /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo "======================================"
