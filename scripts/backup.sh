#!/bin/bash
# scripts/backup.sh — PostgreSQL 일별 자동 백업 스크립트
# 목적: junfire DB를 매일 새벽 2시에 자동 백업하고 30일 초과분 삭제
# crontab 등록: 0 2 * * * /bin/bash /opt/junfire/scripts/backup.sh
# 등록 방법: crontab -e 실행 후 위 줄 추가

# ===== 설정 변수 =====
BACKUP_DIR="/backup/junfire"      # 백업 저장 디렉토리 (실제 경로로 변경)
DB_NAME="junfire_db"              # PostgreSQL 데이터베이스 이름
DB_USER="postgres"                # PostgreSQL 사용자명
TIMESTAMP=$(date +%Y%m%d_%H%M%S) # 백업 파일 타임스탬프
BACKUP_FILE="${BACKUP_DIR}/junfire_${TIMESTAMP}.sql"
KEEP_DAYS=30                      # 보관 기간 (30일 초과 시 자동 삭제)

# ===== 백업 디렉토리 생성 (없으면 자동 생성) =====
mkdir -p "${BACKUP_DIR}"

# ===== pg_dump 실행 =====
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 백업 시작: ${BACKUP_FILE}"
pg_dump -U "${DB_USER}" "${DB_NAME}" > "${BACKUP_FILE}"

# pg_dump 실패 시 즉시 종료
if [ $? -ne 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 백업 실패! pg_dump 오류 발생" >&2
  exit 1
fi

# ===== gzip 압축 =====
gzip "${BACKUP_FILE}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 압축 완료: ${BACKUP_FILE}.gz"

# ===== 30일 초과 오래된 백업 파일 삭제 =====
find "${BACKUP_DIR}" -name "junfire_*.sql.gz" -mtime +"${KEEP_DAYS}" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${KEEP_DAYS}일 초과 백업 파일 정리 완료"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 백업 완료: ${BACKUP_FILE}.gz"
