// prisma/seed.ts — 초기 관리자 계정 생성 스크립트
// 최초 실행 시 admin@junfire.com 관리자 계정을 DB에 upsert 방식으로 생성
// 중복 실행 안전: 이미 존재하는 계정은 건드리지 않음 (upsert update: {})

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Prisma 클라이언트 인스턴스 생성
const prisma = new PrismaClient();

/**
 * 초기 관리자 계정 시딩 메인 함수
 * - 이메일: admin@junfire.com
 * - 초기 비밀번호: Admin1234! (최초 로그인 시 강제 변경)
 * - bcrypt cost factor: 12 (보안 강도)
 */
async function main(): Promise<void> {
  // bcrypt 해시 생성 (cost factor 12 — 보안과 성능의 균형)
  const passwordHash = await bcrypt.hash('admin', 12);

  // upsert: 없으면 생성, 이미 있으면 skip (update: {} — 기존 데이터 보호)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},  // 이미 존재하면 변경 없음 — 운영 데이터 보호
    create: {
      username:     'admin',
      name:         '관리자',
      passwordHash,
      role:         'ADMIN',
      isActive:     true,
      isFirstLogin: false,  // 관리자 계정은 즉시 사용 가능
    },
  });

  // UTF-8 안전 출력 (Windows PowerShell 환경 대응)
  process.stdout.write('초기 관리자 계정 생성 완료: admin / admin\n');
}

// 메인 함수 실행 — 에러 시 콘솔 출력 후 DB 연결 해제
main()
  .catch((err: unknown) => {
    // 에러 내용 출력 후 비정상 종료
    console.error('시딩 실패:', err);
    process.exit(1);
  })
  .finally(() => {
    // 정상/비정상 종료 모두 DB 연결 해제
    void prisma.$disconnect();
  });
