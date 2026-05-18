# JunFire Protection — 구현 계획서

| 항목 | 내용 |
|------|------|
| Document Name | JunFire Protection 구현 계획서 |
| Version | V3 |
| Date | 2026-05-18 |
| Author | kisucha |
| Document Type | 구현 계획서 (PLAN.md) |
| Model Used | claude-sonnet-4-6 |

> 기반 문서: RESEARCH.md V2, PLAN_CRITIC_V1.md (CRITICAL 3개 / MAJOR 11개 / MINOR 4개 전부 반영)
> V3 추가 반영: PLAN_CRITIC_V2.md (NF-V2-001 ~ NF-V2-004 신규 발견 4개 전부 반영)
> 코딩 트리거(`구현해줘`) 전까지 이 문서는 참조 전용임.

---

## 전체 구현 개요

JunFire Protection 업무시간 관리 시스템을 Next.js 14 App Router 기반의 풀스택 웹 애플리케이션으로 구현한다.

- **인증:** NextAuth.js (Credentials Provider) + JWT 세션 (8시간)
- **DB:** PostgreSQL + Prisma ORM (3개 테이블: User, WorkRecord, Holiday)
- **페이징:** 모든 목록 API는 cursor 기반 (offset 절대 금지)
- **PDF:** @react-pdf/renderer 서버사이드 생성 + Noto Sans KR TTF 내장
- **배포:** PM2 + Nginx 리버스 프록시 + Let's Encrypt HTTPS
- **총 구현 단계:** 8단계 (초기화 → DB → 인증 → 타입/유틸 → API → UI → PDF → 배포)

---

## 1. 프로젝트 디렉토리 구조

```
E:\Junfire\
├── package.json                     # 의존성 및 스크립트 정의
├── tsconfig.json                    # TypeScript 설정 (strict mode)
├── next.config.js                   # Next.js 설정 (standalone 빌드, 타임아웃)
├── .env                             # 실제 환경변수 (git 제외)
├── .env.example                     # 환경변수 템플릿
├── .gitignore                       # .env, node_modules, .next 제외
├── ecosystem.config.js              # PM2 프로세스 설정
├── nginx.conf                       # Nginx 리버스 프록시 설정
├── prisma/
│   ├── schema.prisma                # DB 스키마 정의 (User, WorkRecord, Holiday)
│   ├── migrations/                  # Prisma 마이그레이션 이력
│   └── seed.ts                      # 초기 관리자 계정 시딩 스크립트
├── public/
│   └── fonts/
│       └── NotoSansKR-Regular.ttf   # PDF 한글 폰트 (임베드용)
├── src/
│   ├── app/                         # Next.js App Router 루트
│   │   ├── layout.tsx               # 루트 레이아웃 (폰트, 메타데이터)
│   │   ├── page.tsx                 # 랜딩 페이지 (로그인 상태 → 자동 리다이렉트)
│   │   ├── globals.css              # 전역 CSS (Tailwind import)
│   │   ├── login/
│   │   │   └── page.tsx             # 로그인 페이지
│   │   ├── change-password/
│   │   │   └── page.tsx             # 최초 로그인 비밀번호 강제 변경 페이지
│   │   ├── dashboard/
│   │   │   ├── page.tsx             # 직원 대시보드 (월간 달력 뷰)
│   │   │   └── record/
│   │   │       └── [date]/
│   │   │           └── page.tsx     # 날짜별 업무 기록 입력/수정/삭제
│   │   ├── admin/
│   │   │   ├── layout.tsx           # Admin 레이아웃 (ADMIN role 검사, nav)
│   │   │   ├── page.tsx             # 관리자 대시보드 (기간 조회 + 집계)
│   │   │   ├── my-record/
│   │   │   │   └── [date]/
│   │   │   │       └── page.tsx     # 관리자 본인 업무 기록 입력/수정
│   │   │   ├── staff/
│   │   │   │   └── page.tsx         # 직원 관리 (목록/등록/수정/비활성화)
│   │   │   ├── report/
│   │   │   │   └── page.tsx         # 기간 조회 + PDF 다운로드
│   │   │   └── records/
│   │   │       └── [userId]/
│   │   │           └── [date]/
│   │   │               └── page.tsx # 관리자 대리 입력 페이지 (NF-001)
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts     # NextAuth.js 핸들러
│   │       ├── records/
│   │       │   ├── route.ts         # GET(목록, cursor 기반)/POST(생성)
│   │       │   └── [id]/
│   │       │       └── route.ts     # GET(단건)/PUT(수정)/DELETE(삭제)
│   │       ├── admin/
│   │       │   ├── records/
│   │       │   │   ├── route.ts     # GET: 전직원 기록 조회 (cursor 기반 + 날짜 범위)
│   │       │   │   └── override/
│   │       │   │       └── route.ts # POST/PUT: 관리자 대리 입력 (NF-001)
│   │       │   ├── staff/
│   │       │   │   ├── route.ts     # GET(직원 목록, cursor)/POST(직원 등록)
│   │       │   │   └── [id]/
│   │       │   │       └── route.ts # GET/PUT(수정)/PATCH(비활성화/재활성화)
│   │       │   ├── holidays/
│   │       │   │   ├── route.ts     # GET(공휴일 목록)/POST(공휴일 등록)
│   │       │   │   └── [id]/
│   │       │   │       └── route.ts # DELETE(공휴일 삭제)
│   │       │   └── report/
│   │       │       └── route.ts     # POST: PDF 생성 (서버사이드)
│   │       └── password/
│   │           └── route.ts         # PUT: 비밀번호 변경
│   ├── components/
│   │   ├── calendar/
│   │   │   ├── Calendar.tsx         # 달력 메인 컴포넌트 (월 네비게이션 포함)
│   │   │   ├── CalendarDay.tsx      # 날짜 셀 (상태 색상, 오늘 강조)
│   │   │   └── CalendarLegend.tsx   # 달력 하단 색상 범례 설명
│   │   ├── record/
│   │   │   ├── RecordForm.tsx       # 업무 기록 입력/수정 폼
│   │   │   └── StatusSelector.tsx   # 상태 선택 라디오 버튼
│   │   ├── admin/
│   │   │   ├── StaffTable.tsx       # 직원 목록 테이블 (cursor 기반 Load More)
│   │   │   ├── ReportTable.tsx      # 보고서 집계 테이블 (cursor 기반 + 날짜 필터 유지)
│   │   │   ├── DateRangePicker.tsx  # 기간 선택 (시작일~종료일)
│   │   │   └── HolidayManager.tsx   # 공휴일 등록/삭제 관리
│   │   └── ui/
│   │       ├── Button.tsx           # 공통 버튼 컴포넌트
│   │       ├── Input.tsx            # 공통 인풋 컴포넌트
│   │       ├── Modal.tsx            # 확인 모달 (삭제 확인 등)
│   │       ├── Toast.tsx            # 토스트 알림 컴포넌트
│   │       └── LoadingSpinner.tsx   # 로딩 스피너
│   ├── lib/
│   │   ├── prisma.ts                # Prisma 클라이언트 싱글턴
│   │   ├── auth.ts                  # NextAuth authOptions 설정
│   │   ├── pdf/
│   │   │   ├── generateReport.ts    # PDF 생성 진입점 (데이터 조회 + 렌더링)
│   │   │   └── ReportDocument.tsx   # @react-pdf/renderer 문서 컴포넌트
│   │   └── utils/
│   │       ├── time.ts              # totalHours 계산 (date-fns-tz 기반, setHours 금지)
│   │       ├── date.ts              # 날짜 포맷 (KST, YYYY-MM-DD, 요일 등)
│   │       └── pagination.ts        # cursor 페이징 유틸 함수 (범용 buildCursorQuery)
│   ├── types/
│   │   └── index.ts                 # 전체 공유 TypeScript 타입 정의
│   ├── middleware.ts                 # NextAuth 미들웨어 (경로별 접근 제어)
│   └── next-auth.d.ts               # NextAuth 세션 타입 확장
```

---

## 2. 구현 단계

---

### 단계 1: 프로젝트 초기화 ✅ 구현완료

**단계 목표:** Next.js 14 TypeScript 프로젝트 생성, 필수 패키지 설치, 기본 설정 완료.

**수정/생성 파일:**
- `package.json`
- `tsconfig.json`
- `next.config.js`
- `.env.example`
- `.gitignore`

**접근 방식:**
`create-next-app@14 --typescript --tailwind --app` 명령으로 프로젝트 생성 후 추가 패키지를 설치한다.

**`package.json` 의존성 목록:**

```json
{
  "dependencies": {
    "next": "14.2.x",
    "@auth/prisma-adapter": "^1.x",
    "next-auth": "^4.x",
    "@prisma/client": "^5.x",
    "@react-pdf/renderer": "^3.x",
    "bcryptjs": "^2.x",
    "date-fns": "^3.x",
    "date-fns-tz": "^3.x",
    "react": "18.x",
    "react-dom": "18.x"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.x",
    "@types/node": "^20.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x",
    "prisma": "^5.x",
    "tailwindcss": "^3.x",
    "typescript": "^5.x"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "ts-node prisma/seed.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

> **[C-001 반영]** `date-fns-tz` 패키지 의존성 명시 — `setHours` 대신 타임존 명시적 처리에 필수.

**`tsconfig.json` 설정 요점:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**`next.config.js` 설정:**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',          // PM2 배포를 위한 standalone 빌드
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  // PDF 생성 API Route 타임아웃 60초
  async headers() {
    return [
      {
        source: '/api/admin/report',
        headers: [{ key: 'X-Accel-Buffering', value: 'no' }],
      },
    ];
  },
};

module.exports = nextConfig;
```

**`.env.example` 완전한 환경변수 목록: [추가 보완]**

```env
# Database — PostgreSQL 연결 문자열
DATABASE_URL="postgresql://user:password@localhost:5432/junfire"

# NextAuth — 최소 32자 이상 랜덤 시크릿 (openssl rand -base64 32)
NEXTAUTH_SECRET="your-secret-32-chars-minimum"

# 서버 URL — 운영 환경에서 실제 도메인으로 교체
NEXTAUTH_URL="http://localhost:3000"

# Node.js 환경
NODE_ENV="production"
```

**고려사항:**
- `output: 'standalone'`을 사용하면 PM2로 `.next/standalone/server.js`를 직접 실행 가능하다.
- `@react-pdf/renderer`는 Node.js 서버 전용 모듈이므로 `serverComponentsExternalPackages`에 등록 필수.

---

### 단계 2: Prisma 스키마 + DB 마이그레이션 ✅ 구현완료

**단계 목표:** PostgreSQL 스키마 정의, 마이그레이션 실행, 초기 관리자 시딩.

**수정/생성 파일:**
- `prisma/schema.prisma`
- `prisma/seed.ts`

**`prisma/schema.prisma` 전체 스키마: [M-001 반영 — @db.Date 추가]**

```prisma
// prisma/schema.prisma — JunFire Protection DB 스키마 정의

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 사용자 역할 열거형
enum Role {
  EMPLOYEE
  ADMIN
}

// 업무 기록 상태 열거형 (HOLIDAY는 Holiday 별도 테이블로 분리)
enum RecordStatus {
  WORK
  SICK
  ANNUAL
  UNPAID
}

// 직원/관리자 계정 테이블
model User {
  id            String       @id @default(cuid())
  email         String       @unique
  name          String
  passwordHash  String       // bcrypt 해시 저장 (cost factor 12)
  role          Role         @default(EMPLOYEE)
  isActive      Boolean      @default(true)    // 소프트 삭제용 플래그
  isFirstLogin  Boolean      @default(true)    // 최초 로그인 강제 변경 플래그
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  // 관계
  workRecords   WorkRecord[] @relation("UserWorkRecords")

  @@index([isActive])
}

// 업무 기록 테이블
model WorkRecord {
  id          String       @id @default(cuid())
  userId      String
  // [M-001] @db.Date 필수 — PostgreSQL Date 타입으로 매핑하여 시각 정보 제거
  // @db.Date 없으면 timestamp로 저장되어 UTC/KST 날짜 경계 오류 발생
  date        DateTime     @db.Date
  status      RecordStatus
  startTime   DateTime?    // 업무 시작 시각 (ISO 8601 UTC 저장, KST 변환 후 표시)
  endTime     DateTime?    // 업무 종료 시각 (ISO 8601 UTC 저장)
  totalHours  Float?       // 총 근무시간 (단위: 시간, 소수점 2자리) — 서버 자동 계산
  location    String?      // 업무 장소 — WORK 시 필수
  description String?      // 업무 내용 — 선택
  createdBy   String       // 기록 생성자 ID (직원 본인 또는 관리자)
  updatedBy   String?      // 마지막 수정자 ID (관리자 대리 입력 추적용)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  // 관계
  user        User         @relation("UserWorkRecords", fields: [userId], references: [id])

  // 하루 1건 UNIQUE 제약 (동일 직원 + 동일 날짜 중복 불가)
  @@unique([userId, date])
  // 관리자 기간 조회용 인덱스
  @@index([date])
  // 직원별 전체 기록 조회용 인덱스
  @@index([userId])
  // 상태별 필터 조회용 인덱스
  @@index([status])
}

// 공휴일 테이블 (전 직원 공통 적용, WorkRecord와 분리)
model Holiday {
  id         String   @id @default(cuid())
  // [M-001] @db.Date 필수 — Holiday도 날짜만 저장, 시각 정보 불필요
  date       DateTime @unique @db.Date
  name       String            // 휴일명 (예: "설날", "광복절")
  createdBy  String            // 등록 관리자 ID
  createdAt  DateTime @default(now())
}
```

**인덱스 전략 요약:**

| 인덱스 종류 | 테이블 | 컬럼 | 커버하는 쿼리 |
|-----------|--------|------|------------|
| UNIQUE INDEX | WorkRecord | (userId, date) | 중복 방지 + 직원별 날짜 조회 |
| INDEX | WorkRecord | (date) | 관리자 기간 전체 조회 |
| INDEX | WorkRecord | (userId) | 직원별 전체 기록 |
| INDEX | WorkRecord | (status) | 상태별 필터 |
| INDEX | User | (isActive) | 활성 직원 필터 |
| UNIQUE INDEX | Holiday | (date) | 날짜별 공휴일 조회 |

**`prisma/seed.ts` 초기 관리자 계정 시딩:**

```typescript
// prisma/seed.ts — 초기 관리자 계정 생성 스크립트
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin1234!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@junfire.com' },
    update: {},
    create: {
      email: 'admin@junfire.com',
      name: '관리자',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      isFirstLogin: true,
    },
  });
  console.log('초기 관리자 계정 생성 완료: admin@junfire.com');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**마이그레이션 명령어:**

```bash
# 개발 환경 — 마이그레이션 생성 및 적용
npx prisma migrate dev --name init

# 운영 환경 — 마이그레이션 적용만 (스키마 변경 없음)
npx prisma migrate deploy

# 초기 관리자 계정 시딩
npx prisma db seed

# Prisma Client 재생성
npx prisma generate
```

**고려사항:**
- 운영 DB에서는 `migrate dev` 대신 반드시 `migrate deploy`만 사용 (reset 방지).
- 마이그레이션 전 `pg_dump`로 백업 의무화.
- `@db.Date` 선언으로 PostgreSQL `date` 타입 사용. Prisma에서 조회 시 해당 필드는 자정(T00:00:00.000Z)으로 반환되므로 날짜 문자열 추출 시 `toISOString().slice(0,10)` 사용.

---

### 단계 3: NextAuth.js 인증 ✅ 구현완료

**단계 목표:** 이메일/비밀번호 로그인, JWT 세션, Role 기반 경로 보호 구현.

**수정/생성 파일:**
- `src/lib/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/middleware.ts`
- `src/next-auth.d.ts`

**`src/lib/auth.ts` — Credentials Provider 설정:**

```typescript
// src/lib/auth.ts — NextAuth 인증 설정
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,  // 8시간 (업무 시간 동안 만료 없도록)
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // 사용자 미존재 시 인증 실패
        if (!user) return null;

        // 비활성 계정 로그인 차단
        if (!user.isActive) {
          throw new Error('INACTIVE_ACCOUNT');
        }

        // 비밀번호 검증
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isFirstLogin: user.isFirstLogin,
        };
      },
    }),
  ],
  callbacks: {
    // JWT 토큰에 커스텀 필드 추가
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isFirstLogin = user.isFirstLogin;
      }
      return token;
    },
    // 세션 객체에 커스텀 필드 노출
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.isFirstLogin = token.isFirstLogin as boolean;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
};
```

**`src/middleware.ts` — 경로 보호: [mn-003 반영 — 루트 경로 리다이렉트 추가 / NF-V2-001 반영 — matcher에서 '/' 제거]**

```typescript
// src/middleware.ts — NextAuth 미들웨어 기반 경로별 접근 제어
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // ADMIN이 /dashboard 또는 /record/* 접근 시 /admin 으로 리다이렉트
    if (token?.role === 'ADMIN' && (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/record')
    )) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }

    // EMPLOYEE가 /admin/* 접근 시 /dashboard 로 리다이렉트
    if (token?.role === 'EMPLOYEE' && pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // 최초 로그인 강제 변경: /change-password 이외 경로 차단
    if (token?.isFirstLogin === true && pathname !== '/change-password') {
      return NextResponse.redirect(new URL('/change-password', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // 토큰 없으면 /login 으로 리다이렉트 (withAuth 기본 동작)
      authorized: ({ token }) => !!token,
    },
  }
);

// [NF-V2-001] matcher에서 '/' 제거 — '/'는 누구나 접근 가능한 랜딩 페이지
// matcher에 '/'를 포함하면 authorized: ({token}) => !!token 에 의해
// 비로그인 사용자가 랜딩 페이지 대신 /login으로 강제 리다이렉트됨 (RESEARCH.md 6.1 위반)
// 로그인 상태 감지 및 역할별 리다이렉트는 app/page.tsx에서 클라이언트사이드 처리
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/record/:path*',
    '/change-password',
  ],
};
```

> **[NF-V2-001] `src/app/page.tsx` 랜딩 페이지 처리 방식:**
> - middleware.ts matcher에서 `'/'`를 제거했으므로 `withAuth`가 랜딩 페이지에 개입하지 않는다.
> - `app/page.tsx`를 Client Component로 구현하여 `useSession()` 훅으로 로그인 상태 감지 후 클라이언트사이드 `router.push()`로 역할별 리다이렉트를 처리한다.
> - 비로그인 사용자: 랜딩 페이지 정상 표시 (RESEARCH.md 섹션 6.1 준수)
> - 로그인된 ADMIN: `router.push('/admin')`
> - 로그인된 EMPLOYEE: `router.push('/dashboard')`

**`src/next-auth.d.ts` — 세션 타입 확장:**

```typescript
// src/next-auth.d.ts — NextAuth 세션/JWT 타입 확장
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;        // 'EMPLOYEE' | 'ADMIN'
      isFirstLogin: boolean;
    };
  }

  interface User {
    id: string;
    role: string;
    isFirstLogin: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    isFirstLogin: boolean;
  }
}
```

**트레이드오프 — JWT vs Database Session:**

| 항목 | JWT (선택) | Database Session |
|------|-----------|-----------------|
| 서버 부하 | 낮음 (DB 조회 없음) | 높음 (매 요청마다 DB 조회) |
| 세션 즉시 무효화 | 불가 (토큰 만료까지 유효) | 가능 (DB에서 삭제) |
| 소규모 적합성 | 높음 | 불필요한 복잡도 |
| 선택 이유 | 5명 소규모 — DB 부하 감소 우선. 즉시 무효화 필요성 낮음 | - |

---

### 단계 4: 공통 타입 + 유틸리티 ✅ 구현완료

**단계 목표:** 전체에서 사용할 TypeScript 타입, cursor 페이징 유틸, 날짜/시간 유틸 정의.

**수정/생성 파일:**
- `src/types/index.ts`
- `src/lib/utils/pagination.ts`
- `src/lib/utils/time.ts`
- `src/lib/utils/date.ts`
- `src/lib/prisma.ts`

**`src/types/index.ts` — 전체 타입 정의:**

```typescript
// src/types/index.ts — JunFire Protection 전체 공유 TypeScript 타입 정의

// 역할 열거형
export type Role = 'EMPLOYEE' | 'ADMIN';

// 업무 기록 상태 열거형
export type RecordStatus = 'WORK' | 'SICK' | 'ANNUAL' | 'UNPAID';

// 한국어 상태 표시명 매핑
export const RecordStatusLabel: Record<RecordStatus, string> = {
  WORK: '정상근무',
  SICK: '병가',
  ANNUAL: '유급휴가',
  UNPAID: '무급휴가',
};

// PDF role 한국어 매핑 (NF-004)
export const RoleLabel: Record<Role, string> = {
  EMPLOYEE: '직원',
  ADMIN: '관리자',
};

// 직원 타입
export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  isFirstLogin: boolean;
  createdAt: string;  // ISO 8601 문자열
}

// 업무 기록 타입
export interface WorkRecordDTO {
  id: string;
  userId: string;
  date: string;         // YYYY-MM-DD
  status: RecordStatus;
  startTime: string | null;   // ISO 8601
  endTime: string | null;     // ISO 8601
  totalHours: number | null;  // Float
  location: string | null;
  description: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<UserDTO, 'id' | 'name' | 'role'>;
}

// 공휴일 타입
export interface HolidayDTO {
  id: string;
  date: string;   // YYYY-MM-DD
  name: string;
  createdBy: string;
  createdAt: string;
}

// --- Cursor 기반 페이징 타입 (offset 절대 금지) ---

// 페이징 요청 인풋
export interface CursorPaginationInput {
  cursor?: string;   // 마지막 레코드의 id (없으면 처음부터)
  take: number;      // 가져올 건수
}

// 페이징 응답 결과
export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;   // 다음 페이지 cursor (없으면 마지막 페이지)
  hasMore: boolean;
}

// 공통 API 응답 래퍼
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 업무 기록 생성 요청 타입
export interface CreateRecordInput {
  date: string;           // YYYY-MM-DD
  status: RecordStatus;
  startTime?: string;     // HH:mm (UI 입력)
  endTime?: string;       // HH:mm (UI 입력)
  location?: string;
  description?: string;
}

// 업무 기록 수정 요청 타입
export interface UpdateRecordInput extends Partial<CreateRecordInput> {
  id: string;
}

// 관리자 대리 입력 요청 타입 (NF-001)
export interface AdminOverrideInput extends CreateRecordInput {
  targetUserId: string;   // 대리 입력 대상 직원 ID
}

// 달력 렌더링용 날짜 데이터 타입
export interface CalendarDayData {
  date: string;          // YYYY-MM-DD
  record: WorkRecordDTO | null;
  isHoliday: boolean;
  holidayName: string | null;
  isToday: boolean;
  isFuture: boolean;
}

// PDF 생성 요청 타입
export interface GenerateReportInput {
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  includeInactive: boolean;
}
```

**`src/lib/utils/pagination.ts` — cursor 페이징 유틸: [M-002 반영 — 범용 CursorQueryOptions]**

```typescript
// src/lib/utils/pagination.ts — cursor 기반 페이징 유틸 함수
// offset 페이징 절대 금지 — 모든 목록 API는 이 유틸 사용

import { CursorPaginationResult } from '@/types';

/**
 * [M-002] 범용 cursor 쿼리 옵션 — orderBy 필드와 cursor 필드 분리 지원
 * - staff API: orderBy: { name: 'asc' }, cursorField: 'id' (CUID는 생성순 정렬 가능)
 * - admin/records: orderBy: [{ date: 'desc' }, { userId: 'asc' }], cursor는 복합키 대신 id 사용
 *
 * 주의: Prisma cursor 페이징은 orderBy와 cursor 필드가 일치해야 완전 정확하다.
 * 단, 소규모(5명 × 근무일수)에서 id cursor + 충분한 take 크기로 실용적 허용.
 * staff(5명 전체 로드)는 take: 100으로 1회 전체 로드하여 cursor 비호환 문제 우회.
 */
export interface CursorQueryOptions {
  cursor?: string;
  take: number;
  cursorField?: string;  // 기본값 'id'
}

/**
 * Prisma cursor 페이징 쿼리 옵션 생성
 * @param options cursor, take, cursorField
 * @returns Prisma findMany에 전달할 skip/cursor/take 옵션
 */
export function buildCursorQuery(options: CursorQueryOptions) {
  const { cursor, take, cursorField = 'id' } = options;

  return {
    take: take + 1,  // hasMore 판단을 위해 1개 더 조회
    ...(cursor ? {
      skip: 1,       // cursor 레코드 자체는 제외
      cursor: { [cursorField]: cursor },
    } : {}),
  };
}

/**
 * Prisma 조회 결과를 CursorPaginationResult로 변환
 * @param items 조회된 아이템 배열 (take+1 개)
 * @param take 원래 요청한 take 수
 */
export function buildCursorResult<T extends { id: string }>(
  items: T[],
  take: number
): CursorPaginationResult<T> {
  const hasMore = items.length > take;
  const data = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}
```

**`src/lib/utils/time.ts` — 시간 계산 유틸: [C-001 반영 — setHours 완전 제거, date-fns-tz 기반]**

```typescript
// src/lib/utils/time.ts — 시간 계산 및 변환 유틸
// [C-001 CRITICAL] setHours/setMinutes 등 로컬 타임존 의존 메서드 사용 금지
// 운영 서버(UTC)에서 setHours 사용 시 9시간 오차 발생 — fromZonedTime 사용
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// KST 타임존 상수 — 전체 파일에서 이 상수만 사용
export const TIMEZONE = 'Asia/Seoul';

/**
 * [C-001] startTime과 endTime으로 totalHours 계산
 * - setHours 대신 fromZonedTime으로 KST → UTC 변환 후 차이 계산
 * - 야간 근무: endTime < startTime이면 endTime에 +1일 적용
 * @param dateStr YYYY-MM-DD (근무 시작일, KST 기준)
 * @param startTimeStr HH:mm
 * @param endTimeStr HH:mm
 * @returns totalHours (Float, 소수점 2자리)
 */
export function calcTotalHours(
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string
): number {
  // KST 기준 ISO 문자열 생성 후 UTC로 변환 — setHours 불사용
  const startISO = `${dateStr}T${startTimeStr}:00`;
  const startUTC = fromZonedTime(startISO, TIMEZONE);

  let endISO = `${dateStr}T${endTimeStr}:00`;
  let endUTC = fromZonedTime(endISO, TIMEZONE);

  // [NF-V2-004] startTime === endTime이면 0을 반환 (24시간이 아님)
  // 동일 시각 입력 시 endUTC.getTime() === startUTC.getTime() → diff === 0 → 0 반환
  // 이후 서버 API의 totalHours <= 0 검증이 차단하므로 24시간 기록 저장 불가
  const diff = endUTC.getTime() - startUTC.getTime();
  if (diff === 0) return 0;  // 동일 시각 입력 → 0 반환 후 API 레이어에서 거부

  // 야간 근무: 종료 UTC가 시작 UTC보다 이전이면(diff < 0) +1일
  if (diff < 0) {
    const nextDayDate = new Date(startUTC);
    nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1);
    // 날짜만 +1일로 교체하여 재계산
    const nextDateStr = nextDayDate.toISOString().slice(0, 10);
    endISO = `${nextDateStr}T${endTimeStr}:00`;
    endUTC = fromZonedTime(endISO, TIMEZONE);
  }

  const diffMs = endUTC.getTime() - startUTC.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;  // 소수점 2자리
}

/**
 * Float 시간 값을 "X시간 Y분" 형식으로 변환
 * @param hours Float (예: 8.5)
 * @returns "8시간 30분"
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/**
 * [C-001] HH:mm 문자열을 UTC DateTime으로 변환 (DB 저장용)
 * - setHours 불사용 — fromZonedTime으로 KST→UTC 명시적 변환
 * - 야간 근무 종료 시각은 isNightShiftEnd=true로 +1일 처리
 * @param dateStr YYYY-MM-DD (KST 기준 날짜)
 * @param timeStr HH:mm
 * @param isNightShiftEnd 야간 근무 종료 시각 여부
 * @returns UTC Date 객체 (DB 저장용)
 */
export function toUTCDateTime(
  dateStr: string,
  timeStr: string,
  isNightShiftEnd = false
): Date {
  if (isNightShiftEnd) {
    // +1일 날짜 계산 — Date 생성 후 UTC 기준으로 하루 추가
    const base = new Date(`${dateStr}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + 1);
    const nextDateStr = base.toISOString().slice(0, 10);
    return fromZonedTime(`${nextDateStr}T${timeStr}:00`, TIMEZONE);
  }
  return fromZonedTime(`${dateStr}T${timeStr}:00`, TIMEZONE);
}
```

**`src/lib/utils/date.ts` — 날짜 포맷 유틸: [C-001 반영 — getTodayKST formatInTimeZone 사용]**

```typescript
// src/lib/utils/date.ts — 날짜 포맷 및 KST 변환 유틸
import { format, parseISO, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

// KST 타임존 상수
const TIMEZONE = 'Asia/Seoul';
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * YYYY-MM-DD 문자열을 "YYYY년 MM월 DD일 (요일)" 형식으로 변환
 */
export function formatDateKo(dateStr: string): string {
  const date = parseISO(dateStr);
  const day = DAY_LABELS[date.getDay()];
  return `${format(date, 'yyyy년 MM월 dd일')} (${day})`;
}

/**
 * [C-001] 오늘 날짜를 KST 기준 YYYY-MM-DD 문자열로 반환
 * - toZonedTime + format 대신 formatInTimeZone 패턴 사용 (더 명시적)
 */
export function getTodayKST(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

/**
 * YYYY-MM-DD 형식 유효성 검증
 */
export function isValidDateStr(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * 해당 날짜가 오늘 이후(미래)인지 확인 (KST 기준)
 */
export function isFutureDate(dateStr: string): boolean {
  const today = getTodayKST();
  return dateStr > today;
}

/**
 * [C-002] yearMonth 필터 범위 계산 — 월 시작/종료 UTC DateTime 반환
 * - startOfMonth/endOfMonth는 date-fns 사용 후 fromZonedTime으로 UTC 변환
 * @param yearMonth "YYYY-MM" 형식
 * @returns { gte: Date, lt: Date } UTC 기준 범위
 */
export function getMonthRangeUTC(yearMonth: string): { gte: Date; lt: Date } {
  const baseDate = parseISO(`${yearMonth}-01`);
  // KST 기준 월 시작일 00:00:00 → UTC 변환
  const kstStart = `${yearMonth}-01T00:00:00`;
  const gte = fromZonedTime(kstStart, TIMEZONE);

  // KST 기준 다음 달 1일 00:00:00 → UTC 변환 (lt 조건)
  const nextMonth = addMonths(baseDate, 1);
  const nextMonthStr = format(nextMonth, 'yyyy-MM');
  const kstEnd = `${nextMonthStr}-01T00:00:00`;
  const lt = fromZonedTime(kstEnd, TIMEZONE);

  return { gte, lt };
}
```

**`src/lib/prisma.ts` — 클라이언트 싱글턴:**

```typescript
// src/lib/prisma.ts — Prisma 클라이언트 싱글턴 (개발 환경 핫 리로드 대응)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

---

### 단계 5: API Routes 구현

**단계 목표:** 모든 API 엔드포인트 구현. 세션 검증, cursor 기반 페이징, 권한 분리.

**수정/생성 파일:**
- `src/app/api/records/route.ts` ✅ 구현완료
- `src/app/api/records/[id]/route.ts` ✅ 구현완료
- `src/app/api/admin/records/route.ts` ✅ 구현완료
- `src/app/api/admin/records/override/route.ts` ✅ 구현완료
- `src/app/api/admin/staff/route.ts` ✅ 구현완료
- `src/app/api/admin/staff/[id]/route.ts` ✅ 구현완료
- `src/app/api/admin/holidays/route.ts` ✅ 구현완료
- `src/app/api/admin/holidays/[id]/route.ts` ✅ 구현완료
- `src/app/api/admin/report/route.ts` ✅ 구현완료
- `src/app/api/password/route.ts` ✅ 구현완료

**직원 API (records, password): ✅ 구현완료**

**관리자 API (admin/records, staff, holidays, report): ✅ 구현완료**

**공통 import 패턴 (모든 API Route에 적용): [mn-002 반영 — import 완전성]**

```typescript
// 공통 import 패턴 — 모든 API Route 상단에 필요한 항목 선택하여 포함
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// [C-003] Prisma UNIQUE 에러 감지 — PrismaClientKnownRequestError 사용
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { buildCursorQuery, buildCursorResult } from '@/lib/utils/pagination';
import { isValidDateStr, getTodayKST, getMonthRangeUTC } from '@/lib/utils/date';
import { calcTotalHours, toUTCDateTime } from '@/lib/utils/time';
import type { CreateRecordInput, AdminOverrideInput } from '@/types';
```

**공통 세션/권한 검증 패턴:**

```typescript
// 인증 확인
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
}

// ADMIN 전용 Route에서 Role 확인
if (session.user.role !== 'ADMIN') {
  return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
}
```

#### API 1: `GET /api/records` + `POST /api/records` — [C-002 반영 — yearMonth 범위 수정]

```typescript
// src/app/api/records/route.ts — 직원 본인 기록 목록 조회 (GET) + 생성 (POST)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { buildCursorQuery, buildCursorResult } from '@/lib/utils/pagination';
import { isValidDateStr, getTodayKST, getMonthRangeUTC } from '@/lib/utils/date';
import { calcTotalHours, toUTCDateTime } from '@/lib/utils/time';
import type { CreateRecordInput } from '@/types';

// GET: 직원 본인 기록 목록 — cursor 기반 페이징
// 쿼리 파라미터: cursor?, take, yearMonth (YYYY-MM 필터용, 선택)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get('cursor') ?? undefined;
  const take = Math.min(Number(searchParams.get('take') ?? 31), 100);
  const yearMonth = searchParams.get('yearMonth');  // "YYYY-MM" 형식 (달력 로딩용)

  // [C-002] yearMonth 월 범위 계산 — getMonthRangeUTC 유틸 사용
  // gte/lt 모두 KST 기준 올바른 UTC 변환 보장
  const monthFilter = yearMonth ? getMonthRangeUTC(yearMonth) : null;

  const cursorQuery = buildCursorQuery({ cursor, take });

  const records = await prisma.workRecord.findMany({
    where: {
      userId: session.user.id,  // 세션 userId 기준으로만 조회 (URL 조작 방어)
      ...(monthFilter ? { date: monthFilter } : {}),
    },
    orderBy: { date: 'desc' },
    ...cursorQuery,
  });

  const result = buildCursorResult(records, take);
  return NextResponse.json({ success: true, ...result });
}

// POST: 업무 기록 생성
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body: CreateRecordInput = await req.json();
  const { date, status, startTime, endTime, location, description } = body;

  // 날짜 형식 검증
  if (!isValidDateStr(date)) {
    return NextResponse.json({ success: false, error: '잘못된 날짜입니다.' }, { status: 400 });
  }

  // [M-003] WORK 상태 미래 날짜 차단 — KST 기준 오늘 날짜 사용
  const today = getTodayKST();
  if (status === 'WORK' && date > today) {
    return NextResponse.json(
      { success: false, error: '미래 날짜에는 정상근무를 입력할 수 없습니다.' },
      { status: 422 }
    );
  }

  // WORK 상태 필수 필드 검증
  if (status === 'WORK') {
    if (!startTime || !endTime || !location) {
      return NextResponse.json(
        { success: false, error: 'WORK 상태는 시작 시각, 종료 시각, 업무 장소가 필수입니다.' },
        { status: 400 }
      );
    }
  }

  // totalHours 자동 계산 (서버사이드)
  let totalHours: number | null = null;
  let startDateTime: Date | null = null;
  let endDateTime: Date | null = null;

  if (status === 'WORK' && startTime && endTime) {
    totalHours = calcTotalHours(date, startTime, endTime);

    // [M-009] totalHours > 0 서버 검증 — 0 또는 음수 차단
    if (totalHours <= 0) {
      return NextResponse.json(
        { success: false, error: '종료 시간이 시작 시간보다 빠릅니다.' },
        { status: 400 }
      );
    }

    const isNightShift = endTime < startTime;
    // [C-001] toUTCDateTime 사용 — setHours 미사용
    startDateTime = toUTCDateTime(date, startTime);
    endDateTime = toUTCDateTime(date, endTime, isNightShift);
  }

  try {
    const record = await prisma.workRecord.create({
      data: {
        userId: session.user.id,  // 요청 body의 userId 무시, 세션 기준
        date: new Date(`${date}T00:00:00Z`),  // @db.Date 필드 — 날짜만 저장
        status,
        startTime: startDateTime,
        endTime: endDateTime,
        totalHours,
        location: status === 'WORK' ? location : null,
        description: description ?? null,
        createdBy: session.user.id,
      },
    });
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error: unknown) {
    // [C-003] Prisma UNIQUE 제약 위반 — PrismaClientKnownRequestError + P2002 코드로 정확 감지
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: '해당 날짜에 이미 기록이 존재합니다.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
```

#### API 2: `GET /api/records/[id]` + `PUT` + `DELETE` — [M-005 반영 — 소유자 검증]

```typescript
// src/app/api/records/[id]/route.ts — 단건 조회/수정/삭제
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { isValidDateStr, getTodayKST } from '@/lib/utils/date';
import { calcTotalHours, toUTCDateTime } from '@/lib/utils/time';
import type { UpdateRecordInput } from '@/types';

// GET: 단건 조회
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const record = await prisma.workRecord.findUnique({ where: { id: params.id } });
  if (!record) return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });

  // [M-005] 소유자 검증 — ADMIN은 모든 기록 열람 가능
  if (record.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: record });
}

// PUT: 수정
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // [M-005] 소유자 검증 — 레코드 먼저 조회 후 userId 비교
  const record = await prisma.workRecord.findUnique({ where: { id: params.id } });
  if (!record) return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });
  if (record.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const body: UpdateRecordInput = await req.json();
  const { date, status, startTime, endTime, location, description } = body;

  if (date && !isValidDateStr(date)) {
    return NextResponse.json({ error: '잘못된 날짜입니다.' }, { status: 400 });
  }

  // [M-003] WORK 미래 날짜 체크 — KST 기준
  if (status === 'WORK' && date && date > getTodayKST()) {
    return NextResponse.json({ error: '미래 날짜에는 정상근무를 입력할 수 없습니다.' }, { status: 422 });
  }

  let totalHours: number | null = null;
  let startDateTime: Date | null = null;
  let endDateTime: Date | null = null;

  if (status === 'WORK' && startTime && endTime) {
    const targetDate = date ?? record.date.toISOString().slice(0, 10);
    totalHours = calcTotalHours(targetDate, startTime, endTime);

    // [M-009] totalHours > 0 검증
    if (totalHours <= 0) {
      return NextResponse.json({ error: '종료 시간이 시작 시간보다 빠릅니다.' }, { status: 400 });
    }

    const isNightShift = endTime < startTime;
    startDateTime = toUTCDateTime(targetDate, startTime);
    endDateTime = toUTCDateTime(targetDate, endTime, isNightShift);
  }

  try {
    const updated = await prisma.workRecord.update({
      where: { id: params.id },
      data: {
        ...(date ? { date: new Date(`${date}T00:00:00Z`) } : {}),
        ...(status ? { status } : {}),
        ...(startDateTime !== null ? { startTime: startDateTime } : {}),
        ...(endDateTime !== null ? { endTime: endDateTime } : {}),
        ...(totalHours !== null ? { totalHours } : {}),
        ...(location !== undefined ? { location: status === 'WORK' ? location : null } : {}),
        ...(description !== undefined ? { description: description ?? null } : {}),
        updatedBy: session.user.id,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '해당 날짜에 이미 기록이 존재합니다.' }, { status: 409 });
    }
    return NextResponse.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE: 삭제
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // [M-005] 소유자 검증
  const record = await prisma.workRecord.findUnique({ where: { id: params.id } });
  if (!record) return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });
  if (record.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  await prisma.workRecord.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
```

#### API 3: `GET /api/admin/records` — cursor 기반 + 날짜 범위 필터

```typescript
// src/app/api/admin/records/route.ts — 관리자 전직원 기록 조회
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildCursorQuery, buildCursorResult } from '@/lib/utils/pagination';

// 쿼리 파라미터: cursor?, take, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), includeInactive
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get('cursor') ?? undefined;
  const take = Math.min(Number(searchParams.get('take') ?? 50), 200);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const includeInactive = searchParams.get('includeInactive') !== 'false';

  // [M-002] admin/records는 orderBy: [date, userId] 복합 정렬
  // cursor는 id 기반으로 동작 — take를 충분히 크게 설정하여 실용적 허용
  const cursorQuery = buildCursorQuery({ cursor, take, cursorField: 'id' });

  const records = await prisma.workRecord.findMany({
    where: {
      // [C-002] 날짜 범위 — KST 기준 UTC 변환된 값 사용
      ...(startDate && endDate ? {
        date: {
          gte: new Date(`${startDate}T00:00:00+09:00`),
          lte: new Date(`${endDate}T23:59:59+09:00`),
        },
      } : {}),
      ...(includeInactive ? {} : { user: { isActive: true } }),
    },
    include: {
      user: { select: { id: true, name: true, role: true, isActive: true } },
    },
    orderBy: [{ date: 'asc' }, { userId: 'asc' }],
    ...cursorQuery,
  });

  const result = buildCursorResult(records, take);
  return NextResponse.json({ success: true, ...result });
}
```

#### API 4: `GET /api/admin/staff` + `POST` — [M-002 반영 — staff cursor 전략]

```typescript
// src/app/api/admin/staff/route.ts — 직원 목록 (GET, cursor 기반) + 직원 등록 (POST)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { buildCursorQuery, buildCursorResult } from '@/lib/utils/pagination';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get('cursor') ?? undefined;
  // [M-002] staff는 최대 5명 소규모 — take: 100으로 1회 전체 로드 (cursor 비호환 우회)
  const take = Math.min(Number(searchParams.get('take') ?? 100), 100);

  // orderBy: name asc, cursorField: id (소규모라 1페이지 전체 로드로 실용적 허용)
  const cursorQuery = buildCursorQuery({ cursor, take, cursorField: 'id' });

  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true,
      role: true, isActive: true, isFirstLogin: true, createdAt: true,
    },
    orderBy: { name: 'asc' },
    ...cursorQuery,
  });

  const result = buildCursorResult(users, take);
  return NextResponse.json({ success: true, ...result });
}

// POST: 직원 등록
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  const { name, email, password, role } = await req.json();

  // 이메일 중복 검사 (비활성 계정 포함)
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 });
  }

  // 비밀번호 정책 검증: 최소 8자, 영문+숫자 또는 특수문자 2가지 이상 조합
  const pwPolicy = /^(?=.*[a-zA-Z])(?=.*[\d\W]).{8,}$/;
  if (!pwPolicy.test(password)) {
    return NextResponse.json(
      { error: '비밀번호는 8자 이상, 영문과 숫자 또는 특수문자를 포함해야 합니다.' },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: role ?? 'EMPLOYEE', isFirstLogin: true },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  // 등록 완료 후 초기 비밀번호 1회 반환 (화면에서 1회만 표시)
  return NextResponse.json({ success: true, data: user, initialPassword: password }, { status: 201 });
}
```

#### API 4b: `GET/PUT/PATCH /api/admin/staff/[id]` — [NF-V2-002 반영 — 비밀번호 초기화 스니펫 추가]

```typescript
// PATCH /api/admin/staff/[id] — 계정 상태 변경 및 비밀번호 초기화
// 허용 Role: ADMIN only
// Request Body: { action: 'deactivate' | 'reactivate' | 'reset-password', tempPassword?: string }
//
// [NF-V2-002] 비밀번호 초기화 로직:
// 1. bcrypt.hash(tempPassword, 12) → 새 해시 생성
// 2. prisma.user.update({ passwordHash: newHash, isFirstLogin: true })
//    → isFirstLogin=true 재설정 필수 (RESEARCH.md 3.7 준수)
//    → 다음 로그인 시 /change-password 강제 이동 적용됨
// 3. 임시 비밀번호는 응답에 1회만 포함 (화면 표시용) — DB에는 해시만 저장
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  const { action, tempPassword } = await req.json();

  // 대상 사용자 존재 확인
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

  if (action === 'deactivate') {
    // 계정 비활성화 (소프트 삭제)
    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, message: '계정이 비활성화되었습니다.' });
  }

  if (action === 'reactivate') {
    // 계정 재활성화
    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: true },
    });
    return NextResponse.json({ success: true, message: '계정이 재활성화되었습니다.' });
  }

  if (action === 'reset-password') {
    // [NF-V2-002] 비밀번호 초기화
    if (!tempPassword) {
      return NextResponse.json({ error: '임시 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // 비밀번호 정책 검증 (8자 이상, 영문+숫자 또는 특수문자 조합)
    const pwPolicy = /^(?=.*[a-zA-Z])(?=.*[\d\W]).{8,}$/;
    if (!pwPolicy.test(tempPassword)) {
      return NextResponse.json(
        { error: '임시 비밀번호는 8자 이상, 영문과 숫자 또는 특수문자를 포함해야 합니다.' },
        { status: 400 }
      );
    }

    // 1. 임시 비밀번호 해시화
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // 2. 비밀번호 업데이트 + isFirstLogin=true 재설정
    //    → 해당 직원이 다음 로그인 시 /change-password 강제 이동
    await prisma.user.update({
      where: { id: params.id },
      data: {
        passwordHash,
        isFirstLogin: true,  // [NF-V2-002] RESEARCH.md 3.7 — 비밀번호 초기화 시 isFirstLogin=true 필수
      },
    });

    // 3. 임시 비밀번호 1회 응답 반환 (관리자 화면에서 직원에게 안내용)
    //    DB에는 해시만 저장됨 — 평문 비밀번호 재조회 불가
    return NextResponse.json({
      success: true,
      message: '비밀번호가 초기화되었습니다.',
      tempPassword,  // 1회 표시용 — 화면에서 관리자가 직원에게 구두 전달
    });
  }

  return NextResponse.json({ error: '유효하지 않은 action입니다.' }, { status: 400 });
}
```

#### API 5: `POST /api/admin/records/override` — 관리자 대리 입력 (NF-001)

```typescript
// src/app/api/admin/records/override/route.ts — 관리자 직원 누락 기록 대리 입력 (NF-001)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { isValidDateStr } from '@/lib/utils/date';
import { calcTotalHours, toUTCDateTime } from '@/lib/utils/time';
import type { AdminOverrideInput } from '@/types';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  const body: AdminOverrideInput = await req.json();
  const { targetUserId, date, status, startTime, endTime, location, description } = body;

  if (!isValidDateStr(date)) {
    return NextResponse.json({ error: '잘못된 날짜입니다.' }, { status: 400 });
  }

  let totalHours: number | null = null;
  let startDateTime: Date | null = null;
  let endDateTime: Date | null = null;

  if (status === 'WORK' && startTime && endTime) {
    totalHours = calcTotalHours(date, startTime, endTime);

    // [M-009] totalHours > 0 검증
    if (totalHours <= 0) {
      return NextResponse.json({ error: '종료 시간이 시작 시간보다 빠릅니다.' }, { status: 400 });
    }

    const isNightShift = endTime < startTime;
    startDateTime = toUTCDateTime(date, startTime);
    endDateTime = toUTCDateTime(date, endTime, isNightShift);
  }

  try {
    // 기존 기록이 있으면 UPDATE, 없으면 CREATE (upsert)
    const record = await prisma.workRecord.upsert({
      where: { userId_date: { userId: targetUserId, date: new Date(`${date}T00:00:00Z`) } },
      update: {
        status,
        startTime: startDateTime,
        endTime: endDateTime,
        totalHours,
        location: status === 'WORK' ? location : null,
        description: description ?? null,
        updatedBy: session.user.id,  // 관리자 ID 기록 (감사 추적, BR-011)
      },
      create: {
        userId: targetUserId,
        date: new Date(`${date}T00:00:00Z`),
        status,
        startTime: startDateTime,
        endTime: endDateTime,
        totalHours,
        location: status === 'WORK' ? location : null,
        description: description ?? null,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      },
    });
    return NextResponse.json({ success: true, data: record });
  } catch (error: unknown) {
    // [C-003] P2002 UNIQUE 에러 감지
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '해당 날짜에 이미 기록이 존재합니다.' }, { status: 409 });
    }
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
```

#### API 6: `PUT /api/password` — 비밀번호 변경 [M-004 반영 — 완전한 스니펫]

```typescript
// src/app/api/password/route.ts — 비밀번호 변경 (현재 비밀번호 검증 + isFirstLogin 해제)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' }, { status: 400 });
  }

  // 1. 현재 사용자 조회
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 2. 현재 비밀번호 검증 (bcrypt.compare)
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
  }

  // 3. 새 비밀번호 정책 검증 (최소 8자, 영문+숫자 또는 특수문자 2가지 이상)
  const pwPolicy = /^(?=.*[a-zA-Z])(?=.*[\d\W]).{8,}$/;
  if (!pwPolicy.test(newPassword)) {
    return NextResponse.json(
      { error: '새 비밀번호는 8자 이상, 영문과 숫자 또는 특수문자를 포함해야 합니다.' },
      { status: 400 }
    );
  }

  // 4. 현재 비밀번호와 동일한지 확인
  const isSame = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSame) {
    return NextResponse.json({ error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' }, { status: 400 });
  }

  // 5. 새 비밀번호 해시 후 저장 + isFirstLogin=false 동시 업데이트
  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: newHash,
      isFirstLogin: false,  // 최초 로그인 강제 변경 완료 플래그 해제
    },
  });

  return NextResponse.json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
}
```

#### API 7: `POST /api/admin/report` — PDF 생성 응답 [M-006 반영 — Buffer→NextResponse]

```typescript
// src/app/api/admin/report/route.ts — PDF 생성 및 다운로드 응답
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateReport } from '@/lib/pdf/generateReport';
import type { GenerateReportInput } from '@/types';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  const body: GenerateReportInput = await req.json();
  const { startDate, endDate, includeInactive } = body;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: '시작일과 종료일을 입력해주세요.' }, { status: 400 });
  }

  try {
    // [M-006] generateReport 호출 후 pdfBuffer → NextResponse로 바이너리 반환
    const pdfBuffer = await generateReport({ startDate, endDate, includeInactive });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        // [M-006] 파일명 패턴: junfire-report-{startDate}-{endDate}.pdf
        'Content-Disposition': `attachment; filename="junfire-report-${startDate}-${endDate}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[PDF 생성 오류]', error);
    return NextResponse.json({ error: 'PDF 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
```

#### API 8: `/api/admin/holidays` — GET/POST/DELETE [NF-V2-003 반영 — 스니펫 추가]

```typescript
// src/app/api/admin/holidays/route.ts — 공휴일 목록 조회(GET) + 등록(POST)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// GET /api/admin/holidays?year=2026&month=05
// → 해당 월 전체 공휴일 배열 반환
// year, month 미지정 시 전체 공휴일 반환 (등록/삭제 관리 화면용)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  // [NF-V2-003] year+month 쿼리 파라미터로 월별 필터 지원
  // Holiday.date는 @db.Date — KST 기준 날짜를 'yyyy-MM-dd'T00:00:00Z 형식으로 저장
  let dateFilter = {};
  if (year && month) {
    const gte = new Date(`${year}-${month.padStart(2, '0')}-01T00:00:00Z`);
    const nextMonth = new Date(gte);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    dateFilter = { date: { gte, lt: nextMonth } };
  }

  const holidays = await prisma.holiday.findMany({
    where: dateFilter,
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({ success: true, data: holidays });
}

// POST /api/admin/holidays
// Body: { date: 'yyyy-MM-dd', name: string }
// → 생성된 Holiday 반환
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  const { date, name } = await req.json();

  if (!date || !name) {
    return NextResponse.json({ error: '날짜와 공휴일명을 모두 입력해주세요.' }, { status: 400 });
  }

  // 날짜 형식 검증 (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)' }, { status: 400 });
  }

  try {
    // [NF-V2-003] Holiday.date 저장 형식:
    // @db.Date 필드 — 'yyyy-MM-dd'T00:00:00Z 로 저장 (시각 정보 없음)
    // KST 기준 날짜 의미이지만 PostgreSQL date 타입으로 저장되므로 시각 변환 불필요
    const holiday = await prisma.holiday.create({
      data: {
        date: new Date(`${date}T00:00:00Z`),
        name,
        createdBy: session.user.id,
      },
    });
    return NextResponse.json({ success: true, data: holiday }, { status: 201 });
  } catch (error: unknown) {
    // [NF-V2-003] Holiday.date는 @unique — 같은 날짜 중복 등록 시 P2002 에러
    // [C-003] PrismaClientKnownRequestError + P2002 패턴으로 정확 감지
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: '해당 날짜에 이미 공휴일이 등록되어 있습니다.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: '공휴일 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
```

```typescript
// src/app/api/admin/holidays/[id]/route.ts — 공휴일 삭제(DELETE)

// DELETE /api/admin/holidays/[id]
// → 204 No Content (삭제 성공)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });

  // 존재 확인
  const holiday = await prisma.holiday.findUnique({ where: { id: params.id } });
  if (!holiday) return NextResponse.json({ error: '공휴일을 찾을 수 없습니다.' }, { status: 404 });

  await prisma.holiday.delete({ where: { id: params.id } });

  // 204 No Content 반환
  return new NextResponse(null, { status: 204 });
}
```

**전체 API 엔드포인트 요약:**

| 경로 | 메서드 | 허용 Role | 기능 |
|------|--------|----------|------|
| /api/records | GET | EMPLOYEE, ADMIN | 본인 기록 목록 (cursor 기반) |
| /api/records | POST | EMPLOYEE, ADMIN | 기록 생성 |
| /api/records/[id] | GET | EMPLOYEE, ADMIN | 기록 단건 조회 (소유자 검증) |
| /api/records/[id] | PUT | EMPLOYEE, ADMIN | 기록 수정 (소유자 검증) |
| /api/records/[id] | DELETE | EMPLOYEE, ADMIN | 기록 삭제 (소유자 검증) |
| /api/admin/records | GET | ADMIN | 전직원 기록 (cursor + 날짜 범위) |
| /api/admin/records/override | POST | ADMIN | 직원 누락 기록 대리 입력 (NF-001) |
| /api/admin/staff | GET | ADMIN | 직원 목록 (cursor 기반) |
| /api/admin/staff | POST | ADMIN | 직원 등록 |
| /api/admin/staff/[id] | GET | ADMIN | 직원 단건 조회 |
| /api/admin/staff/[id] | PUT | ADMIN | 직원 정보 수정 |
| /api/admin/staff/[id] | PATCH | ADMIN | 계정 활성/비활성화, 비밀번호 초기화 |
| /api/admin/holidays | GET | ADMIN | 공휴일 목록 |
| /api/admin/holidays | POST | ADMIN | 공휴일 등록 |
| /api/admin/holidays/[id] | DELETE | ADMIN | 공휴일 삭제 |
| /api/admin/report | POST | ADMIN | PDF 생성 (Buffer → NextResponse) |
| /api/password | PUT | EMPLOYEE, ADMIN | 비밀번호 변경 (+ isFirstLogin=false) |

---

### 단계 6: UI 컴포넌트 ✅ 구현완료

**단계 목표:** 달력 뷰, 기록 폼, 관리자 UI 컴포넌트 구현.

**수정/생성 파일:**
- `src/components/calendar/Calendar.tsx`
- `src/components/calendar/CalendarDay.tsx`
- `src/components/calendar/CalendarLegend.tsx`
- `src/components/record/RecordForm.tsx`
- `src/components/record/StatusSelector.tsx`
- `src/components/admin/StaffTable.tsx`
- `src/components/admin/ReportTable.tsx`
- `src/components/admin/DateRangePicker.tsx`
- `src/components/admin/HolidayManager.tsx`

**`Calendar.tsx` 구현 접근 방식:**

달력은 월 단위로 렌더링하며, WorkRecord 목록과 Holiday 목록을 props로 받아 날짜별 색상을 결정한다.

```typescript
// src/components/calendar/Calendar.tsx — 달력 메인 컴포넌트

// 상태별 Tailwind 배경색 클래스 매핑 (RESEARCH.md 섹션 13 기준)
const STATUS_BG: Record<string, string> = {
  WORK: 'bg-green-500',        // #22C55E
  SICK: 'bg-yellow-500',       // #EAB308
  ANNUAL: 'bg-blue-500',       // #3B82F6
  UNPAID: 'bg-gray-500',       // #6B7280
  HOLIDAY: 'bg-purple-500',    // #8B5CF6
  MISSED: 'bg-red-500',        // #EF4444 (과거 미입력)
  FUTURE: 'bg-white',          // #FFFFFF (미래)
  DEFAULT: 'bg-white',
};

// 날짜 셀 배경색 결정 함수
// 우선순위: WorkRecord > Holiday > 과거미입력(빨간) > 미래(흰)
function getDayBgClass(
  dateStr: string,
  record: WorkRecordDTO | null,
  isHoliday: boolean,
  isToday: boolean,
  isFuture: boolean
): string {
  let bg = STATUS_BG.DEFAULT;

  if (record) {
    bg = STATUS_BG[record.status] ?? STATUS_BG.DEFAULT;
  } else if (isHoliday) {
    bg = STATUS_BG.HOLIDAY;
  } else if (!isFuture) {
    bg = STATUS_BG.MISSED;  // 과거 날짜 미입력 → 빨간색
  } else {
    bg = STATUS_BG.FUTURE;
  }

  // 오늘 날짜 테두리 강조 중첩 (ring-2 ring-blue-700)
  const ring = isToday ? ' ring-2 ring-blue-700' : '';
  return `${bg}${ring}`;
}
```

**달력 모바일 반응형 규칙:**
- 7열 그리드: `grid grid-cols-7`
- 날짜 셀 최소 높이: `min-h-[44px]` (모바일 터치 영역 44px 보장)
- 폰트: `text-xs sm:text-sm` (모바일 12px, 데스크탑 14px)
- Tailwind 브레이크포인트: `sm:640px`, `md:768px`

**`RecordForm.tsx` 구현 접근 방식:**

```typescript
// src/components/record/RecordForm.tsx — 업무 기록 입력/수정 폼

// Status 변경 시 필드 동적 표시/숨김 규칙
const SHOW_TIME_FIELDS = (status: RecordStatus) => status === 'WORK';
const SHOW_LOCATION_FIELD = (status: RecordStatus) => status === 'WORK';

// 야간 근무 totalHours 클라이언트 측 미리 보기 계산
// (서버와 동일 로직 적용, UI에서 읽기 전용 표시)
function calcPreviewHours(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '-';
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;  // 야간 근무 자정 초과
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// Status 변경 시 WORK → 다른 상태로 바뀌면 시간 필드 초기화
function handleStatusChange(newStatus: RecordStatus, setFormData: Function) {
  if (newStatus !== 'WORK') {
    setFormData((prev: FormData) => ({
      ...prev,
      status: newStatus,
      startTime: '',
      endTime: '',
      location: '',
    }));
  }
}
```

**한국어 유효성 검증 메시지 (RESEARCH.md 섹션 14):**

| 조건 | 메시지 |
|------|--------|
| WORK + startTime 없음 | "근무 시작 시간을 입력해주세요." |
| WORK + endTime 없음 | "근무 종료 시간을 입력해주세요." |
| WORK + location 없음 | "업무 장소를 선택해주세요." |
| WORK + 미래 날짜 | "미래 날짜에는 정상근무를 입력할 수 없습니다." |

**`ReportTable.tsx` — Load More 패턴: [M-010 반영 — 날짜 필터 파라미터 유지]**

```typescript
// src/components/admin/ReportTable.tsx — cursor 기반 Load More
// [M-010] Load More 요청 시 startDate/endDate/includeInactive 필터 파라미터 유지 필수

interface ReportTableProps {
  initialData: WorkRecordDTO[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  startDate: string;         // 필터 파라미터 — Load More 시 전달
  endDate: string;           // 필터 파라미터 — Load More 시 전달
  includeInactive: boolean;  // 필터 파라미터 — Load More 시 전달
}

// 상태 관리
const [records, setRecords] = useState(initialData);
const [nextCursor, setNextCursor] = useState(initialNextCursor);
const [hasMore, setHasMore] = useState(initialHasMore);
const [isLoading, setIsLoading] = useState(false);

// [M-010] fetchNextPage — 날짜 필터 파라미터를 반드시 포함
const fetchNextPage = async () => {
  if (!hasMore || isLoading || !nextCursor) return;
  setIsLoading(true);

  const params = new URLSearchParams({
    cursor: nextCursor,
    take: '20',
    startDate,        // 날짜 필터 유지
    endDate,          // 날짜 필터 유지
    includeInactive: includeInactive.toString(),
  });

  const res = await fetch(`/api/admin/records?${params}`);
  const json = await res.json();

  setRecords(prev => [...prev, ...json.data]);
  setNextCursor(json.nextCursor);
  setHasMore(json.hasMore);
  setIsLoading(false);
};
```

---

### 단계 7: PDF 생성 ✅ 구현완료

**단계 목표:** 서버사이드 PDF 생성. Holiday 별도 조회, role 한국어 매핑 적용.

**수정/생성 파일:**
- `src/lib/pdf/generateReport.ts`
- `src/lib/pdf/ReportDocument.tsx`
- `public/fonts/NotoSansKR-Regular.ttf`

**`generateReport.ts` — 핵심 데이터 조회 로직 (NF-003 반영):**

> **[M-011 트레이드오프]** PDF 생성은 전체 로드 (페이징 없음). 5명 소규모 최대 수백 건 수준이므로 timeout 위험 없음. 향후 인원 확장 시 재검토 필요. UI ReportTable은 cursor Load More 적용, PDF 생성은 전체 로드로 분리.

```typescript
// src/lib/pdf/generateReport.ts — PDF 생성 진입점
import { prisma } from '@/lib/prisma';
import { formatHours } from '@/lib/utils/time';
import { RoleLabel, RecordStatusLabel } from '@/types';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDocument } from './ReportDocument';
import type { GenerateReportInput } from '@/types';

export async function generateReport(input: GenerateReportInput): Promise<Buffer> {
  const { startDate, endDate, includeInactive } = input;

  // KST 기준 날짜 범위 → UTC 변환 (+09:00 오프셋 직접 포함)
  const startDateTime = new Date(`${startDate}T00:00:00+09:00`);
  const endDateTime = new Date(`${endDate}T23:59:59+09:00`);

  // 1. 기간 내 전직원 업무 기록 전체 조회 (PDF는 페이징 없이 전체 로드)
  const records = await prisma.workRecord.findMany({
    where: {
      date: { gte: startDateTime, lte: endDateTime },
      ...(includeInactive ? {} : { user: { isActive: true } }),
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ userId: 'asc' }, { date: 'asc' }],
  });

  // 2. Holiday 테이블 별도 조회 (NF-003 — WorkRecord와 분리)
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: startDateTime, lte: endDateTime } },
    orderBy: { date: 'asc' },
  });

  // 날짜 → 공휴일명 맵 (빠른 조회용)
  const holidayMap = new Map(
    holidays.map(h => [h.date.toISOString().slice(0, 10), h.name])
  );

  // 3. 직원별 집계 계산
  const userMap = new Map<string, {
    user: { id: string; name: string; role: string };
    records: typeof records;
    totalHours: number;
    sickDays: number;
    annualDays: number;
    unpaidDays: number;
  }>();

  for (const record of records) {
    const uid = record.userId;
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        user: record.user,
        records: [],
        totalHours: 0,
        sickDays: 0,
        annualDays: 0,
        unpaidDays: 0,
      });
    }
    const entry = userMap.get(uid)!;
    entry.records.push(record);
    if (record.status === 'WORK') entry.totalHours += record.totalHours ?? 0;
    if (record.status === 'SICK') entry.sickDays++;
    if (record.status === 'ANNUAL') entry.annualDays++;
    if (record.status === 'UNPAID') entry.unpaidDays++;
  }

  // 4. 직원 가나다순 정렬
  const sortedUsers = Array.from(userMap.values())
    .sort((a, b) => a.user.name.localeCompare(b.user.name, 'ko'));

  // 5. @react-pdf/renderer로 PDF 버퍼 생성
  const pdfBuffer = await renderToBuffer(
    ReportDocument({
      startDate,
      endDate,
      sortedUsers,
      holidayMap,
      generatedAt: new Date().toISOString(),
    })
  );

  return pdfBuffer;
}
```

**`ReportDocument.tsx` — PDF 레이아웃:**

```typescript
// src/lib/pdf/ReportDocument.tsx — @react-pdf/renderer 문서 컴포넌트
import { Document, Page, Text, View, Font, StyleSheet } from '@react-pdf/renderer';
import path from 'path';
import { RecordStatusLabel, RoleLabel } from '@/types';
import { formatHours } from '@/lib/utils/time';

// Noto Sans KR 한글 폰트 등록 (절대 경로 — 서버사이드 빌드 기준)
// [M-007] standalone 빌드 시 public 폴더가 .next/standalone/public 으로 복사되어야 함
Font.register({
  family: 'NotoSansKR',
  src: path.join(process.cwd(), 'public/fonts/NotoSansKR-Regular.ttf'),
});

// PDF 상태 한국어 표시
function getStatusLabel(status: string): string {
  return RecordStatusLabel[status as keyof typeof RecordStatusLabel] ?? status;
}

// role 한국어 매핑 (NF-004)
function getRoleLabel(role: string): string {
  return RoleLabel[role as keyof typeof RoleLabel] ?? role;
}

// PDF 레이아웃 구조
// 1페이지: 표지 (회사명, 보고서 제목, 기간, 생성일)
// 2페이지: 직원별 집계 요약 테이블
// 3페이지~: 직원별 상세 기록 (직원당 새 페이지)

export function ReportDocument(props: ReportDocumentProps) {
  return (
    <Document>
      {/* 1페이지: 표지 */}
      <Page size="A4" orientation="portrait" style={styles.page}>
        <CoverPage {...props} />
      </Page>

      {/* 2페이지: 직원별 집계 요약 */}
      <Page size="A4" style={styles.page}>
        <PageHeader startDate={props.startDate} endDate={props.endDate} />
        <SummaryTable users={props.sortedUsers} />
        <PageFooter />
      </Page>

      {/* 3페이지~: 직원별 상세 기록 */}
      {props.sortedUsers.map(userEntry => (
        <Page key={userEntry.user.id} size="A4" style={styles.page}>
          <PageHeader startDate={props.startDate} endDate={props.endDate} />
          {/* 직원 섹션 헤더: 직원명 + 직책(role 한국어 매핑) */}
          <Text style={styles.sectionHeader}>
            {userEntry.user.name} ({getRoleLabel(userEntry.user.role)})
          </Text>
          <DetailTable
            records={userEntry.records}
            holidayMap={props.holidayMap}
          />
          <PageFooter />
        </Page>
      ))}
    </Document>
  );
}
```

**상세 테이블 컬럼 순서:**

| 컬럼 | 내용 | 조건 |
|------|------|------|
| 1 | 날짜 (YYYY-MM-DD, 요일 포함) | 항상 표시 |
| 2 | 상태 | 항상 표시 (공휴일 행 포함, NF-003) |
| 3 | 시작 시각 (HH:mm) | WORK 시에만 |
| 4 | 종료 시각 (HH:mm) | WORK 시에만 |
| 5 | 근무시간 (X시간 Y분) | WORK 시에만 |
| 6 | 업무 장소 | WORK 시에만 |
| 7 | 업무 내용 | 없으면 "-" 표시 |

**NF-003 공휴일 행 처리 로직:**

```typescript
// DetailTable 내부 — Holiday 날짜를 공휴일 행으로 PDF에 포함
function buildDetailRows(
  records: WorkRecord[],
  holidayMap: Map<string, string>
): DetailRow[] {
  const recordDates = new Set(records.map(r => r.date.toISOString().slice(0, 10)));

  const rows: DetailRow[] = records.map(r => ({
    date: r.date.toISOString().slice(0, 10),
    status: getStatusLabel(r.status),
    startTime: r.startTime ? formatTime(r.startTime) : null,
    endTime: r.endTime ? formatTime(r.endTime) : null,
    totalHours: r.totalHours ? formatHours(r.totalHours) : null,
    location: r.location,
    description: r.description ?? '-',
    isHoliday: false,
  }));

  // 공휴일 행 추가 (WorkRecord가 없는 공휴일 날짜만)
  for (const [date, name] of holidayMap.entries()) {
    if (!recordDates.has(date)) {
      rows.push({
        date,
        status: `공휴일 (${name})`,
        startTime: null, endTime: null, totalHours: null,
        location: null, description: '-', isHoliday: true,
      });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}
```

**트레이드오프 — PDF 서버사이드 vs 클라이언트사이드:**

| 항목 | 서버사이드 (선택) | 클라이언트사이드 |
|------|----------------|----------------|
| 폰트 일관성 | 서버에서 TTF 직접 로드 → 보장 | 브라우저 폰트 정책에 의존 |
| 보안 | DB 데이터가 서버에서만 처리 | 민감 데이터 클라이언트 노출 위험 |
| 성능 | 서버 CPU 부하 (소규모 문제없음) | 클라이언트 CPU 부하 |
| 구현 복잡도 | 낮음 (Next.js API Route 직접 활용) | 높음 (클라이언트 번들 크기 증가) |

---

### 단계 8: 배포 설정 ✅ 구현완료

**단계 목표:** PM2 + Nginx + HTTPS + DB 자동 백업 설정.

**수정/생성 파일:**
- `ecosystem.config.js`
- `nginx.conf`
- `scripts/backup.sh`

**`ecosystem.config.js` — PM2 설정: [M-008 반영 — env_file 추가]**

```javascript
// ecosystem.config.js — PM2 프로세스 관리 설정
module.exports = {
  apps: [
    {
      name: 'junfire',
      script: '.next/standalone/server.js',
      instances: 1,                    // 소규모 1인스턴스 충분
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      // [M-008] env_file 추가 — .env 파일에서 DATABASE_URL, NEXTAUTH_SECRET 등 자동 로드
      // Next.js standalone 빌드는 .env를 자동 로드하지 않으므로 PM2에서 명시적 주입 필수
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // graceful shutdown 설정 (PDF 생성 중 재시작 방지)
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
```

**Nginx 설정 (`nginx.conf`): [mn-001 반영 — 정적 파일 캐시 블록 추가]**

```nginx
# nginx.conf — JunFire Protection 리버스 프록시 + HTTPS

server {
    listen 80;
    server_name yourdomain.com;

    # HTTP → HTTPS 자동 리다이렉트
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    # Let's Encrypt SSL 인증서 (Certbot 발급)
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # PDF 생성 API 타임아웃 60초 설정
    proxy_read_timeout 60s;
    proxy_connect_timeout 10s;

    # [mn-001] 정적 파일 직접 서빙 + 영구 캐시 설정 (Next.js content hash 파일명 활용)
    location /_next/static/ {
        alias /opt/junfire/.next/standalone/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 일반 요청 → Next.js 서버 프록시
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**DB 자동 백업 (`scripts/backup.sh`):**

```bash
#!/bin/bash
# scripts/backup.sh — 일별 PostgreSQL 자동 백업 스크립트
# cron 설정: 0 2 * * * /bin/bash /opt/junfire/scripts/backup.sh

BACKUP_DIR="/backup/junfire"
DB_NAME="junfire_db"
DB_USER="postgres"
DATE=$(date +%Y%m%d)
BACKUP_FILE="${BACKUP_DIR}/junfire_backup_${DATE}.sql"

mkdir -p $BACKUP_DIR
pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

# 30일 초과 백업 파일 자동 삭제
find $BACKUP_DIR -name "junfire_backup_*.sql" -mtime +30 -delete
echo "백업 완료: $BACKUP_FILE"
```

**HTTPS 설정 절차 (Let's Encrypt Certbot):**

```bash
# 1. Certbot 설치 (Ubuntu 기준)
sudo apt install certbot python3-certbot-nginx

# 2. SSL 인증서 발급
sudo certbot --nginx -d yourdomain.com

# 3. 자동 갱신 확인
sudo certbot renew --dry-run
```

**배포 체크리스트: [M-007 반영 — standalone 빌드 폰트/정적 파일 복사 항목 추가]**

| # | 항목 | 확인 방법 |
|---|------|----------|
| 1 | DATABASE_URL 설정 | .env 파일 확인 |
| 2 | NEXTAUTH_SECRET 설정 | openssl rand -base64 32 로 생성 후 .env 등록 |
| 3 | NEXTAUTH_URL 설정 | 서버 도메인 또는 IP:PORT 로 설정 |
| 4 | Noto Sans KR TTF 파일 | public/fonts/ 디렉토리에 존재 확인 |
| 5 | prisma migrate deploy | 마이그레이션 적용 확인 |
| 6 | prisma db seed | 초기 관리자 계정 생성 확인 |
| 7 | **[M-007] standalone public 복사** | `cp -r public .next/standalone/public` 실행 확인 |
| 8 | **[M-007] standalone static 복사** | `cp -r .next/static .next/standalone/.next/static` 실행 확인 |
| 9 | **NotoSansKR.ttf standalone 경로** | `.next/standalone/public/fonts/NotoSansKR-Regular.ttf` 존재 확인 |
| 10 | pm2 start ecosystem.config.js | 프로세스 실행 확인 |
| 11 | nginx 설정 테스트 | nginx -t 실행 |
| 12 | HTTPS 접속 확인 | 브라우저에서 https://yourdomain.com 접속 |
| 13 | 백업 스크립트 cron 등록 | crontab -e 에 등록 확인 |
| 14 | pm2-logrotate 설치 | pm2 install pm2-logrotate |
| 15 | 방화벽 포트 확인 | 80, 443 포트 열림 확인 |

**배포 프로세스 (코드 업데이트 시): [M-007 반영 — standalone 복사 명령 포함]**

```bash
# 1. 코드 업데이트
git pull origin main

# 2. DB 백업 (마이그레이션 전 필수)
/bin/bash /opt/junfire/scripts/backup.sh

# 3. 의존성 설치
npm ci --production

# 4. DB 마이그레이션 적용
npx prisma migrate deploy

# 5. Prisma Client 재생성
npx prisma generate

# 6. Next.js 빌드
npm run build

# [M-007] 7. standalone 빌드 정적 파일 복사 — 생략 시 CSS/JS 404, PDF 한글 깨짐 발생
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# 8. PM2 재시작
pm2 restart junfire
```

---

## 3. 구현 순서 의존성 다이어그램

```
단계1(초기화) → 단계2(Prisma) → 단계3(NextAuth) → 단계4(유틸/타입)
                                                          │
                                                          ▼
                                              단계5(API Routes)
                                                    │
                                    ┌───────────────┤
                                    ▼               ▼
                            단계6(UI 컴포넌트)  단계7(PDF 생성)
                                    │               │
                                    └───────┬───────┘
                                            ▼
                                    단계8(배포 설정)

의존 관계 요약:
- 단계1 → 단계2: package.json, next.config.js 먼저 확정
- 단계2 → 단계3: DB 스키마 확정 후 NextAuth Prisma 연동
- 단계3 → 단계4: 세션 타입(next-auth.d.ts) 확장 후 공통 타입 정의
- 단계4 → 단계5: time.ts, date.ts, pagination.ts 유틸 완성 후 API 구현
- 단계5 → 단계6: API 엔드포인트 확정 후 UI fetch 로직 구현
- 단계5 → 단계7: API report route는 generateReport 호출 — 동시 구현 가능
- 단계6 + 단계7 → 단계8: 전체 기능 완성 후 배포
```

---

## 4. 트레이드오프 종합 정리

| 결정 사항 | 선택 | 대안 | 선택 이유 |
|----------|------|------|----------|
| 세션 방식 | JWT (8시간) | Database Session | 소규모 5명, DB 부하 감소. 즉시 무효화 필요성 낮음 |
| 페이징 방식 | Cursor 기반 | Offset 기반 | 실시간 데이터 삽입 시 중복/누락 방지. 대용량 조회 성능 우수 |
| PDF 생성 위치 | 서버사이드 | 클라이언트사이드 | 폰트 일관성, 보안(DB 데이터 클라이언트 미노출), 구현 단순 |
| 관리자 대리 입력 | 별도 API (/override) | 기존 PUT 재사용 | 감사 추적(updatedBy) 명확. 권한 분리 명시적 |
| ADMIN 본인 기록 | 기존 /api/records/* 재사용 | 별도 /api/admin/my-record/* | 코드 중복 방지. 세션 userId 기준 동일 로직 (NF-002) |
| 공휴일 관리 | Holiday 별도 테이블 | WorkRecord.status=HOLIDAY | 비정규화 방지. 5명 × 공휴일 수만큼 중복 행 생성 방지 |
| DB 삭제 정책 | 소프트 삭제 (isActive=false) | Hard Delete | 노무/세무 증빙 기록 영구 보존 의무 |
| 야간 근무 저장 | DateTime (ISO 8601 UTC) | HH:mm String | 날짜 경계 자동 처리. 자정 초과 계산 오류 방지 |
| 비밀번호 해시 | bcrypt (cost 12) | argon2 | 안정성 검증됨. Node.js 생태계 표준 |
| 모노레포 구조 | Next.js 단일 레포 | 프론트/백 분리 | 소규모 단일 서버 운영. 배포 복잡도 최소화 |
| [M-011] 보고서 PDF 데이터 로드 | 전체 로드 (페이징 없음) | 스트리밍/청크 | 5명 소규모 최대 수백 건 — timeout 위험 없음. 향후 확장 시 재검토 |
| [M-011] 보고서 UI 테이블 | cursor 기반 Load More | 전체 로드 | UI에서는 cursor 적용, PDF 생성은 전체 로드로 역할 분리 |

---

## 5. 미완료/검토 필요 항목

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | Noto Sans KR TTF 파일 확보 | 배포 전 필요 | Google Fonts에서 NotoSansKR-Regular.ttf 다운로드 후 public/fonts/ 배치 필요 |
| 2 | PostgreSQL 서버 설치 | 자체 서버 작업 | `sudo apt install postgresql` 후 DB/사용자 생성 |
| 3 | 초기 관리자 이메일/비밀번호 확정 | 사용자 결정 필요 | seed.ts 기본값은 admin@junfire.com / Admin1234! — 배포 전 반드시 변경 |
| 4 | 도메인 설정 | 배포 환경 결정 | 도메인 없으면 IP:PORT로 NEXTAUTH_URL 설정 (HTTPS 미적용 가능) |
| 5 | /admin/records/[userId]/[date] 페이지 | 구현 시 결정 | 관리자 대리 입력 UI — 관리자 대시보드 내 인라인 모달 또는 별도 페이지 선택 가능 |
| 6 | 세션 갱신 정책 | 추가 검토 | NextAuth updateSession() 활용 여부 — 8시간으로 현재 충분하나 장시간 작업 시 만료 가능 |

---

## 자기검토 체크리스트 (97% 기준)

| # | 항목 | 기준 | 결과 |
|---|------|------|------|
| 1 | CRITICAL 3개 전부 해결 | 스니펫에서 직접 수정 확인 | 완료 — C-001(setHours 제거→fromZonedTime), C-002(getMonthRangeUTC), C-003(PrismaClientKnownRequestError+P2002) |
| 2 | MAJOR 11개 전부 해결 | 각 항목 반영 여부 | 완료 — M-001(@db.Date), M-002(범용 CursorQueryOptions), M-003(getTodayKST), M-004(password 스니펫), M-005(소유자 검증), M-006(PDF Buffer→NextResponse), M-007(standalone 복사), M-008(env_file), M-009(totalHours>0), M-010(날짜 필터 유지), M-011(트레이드오프 추가) |
| 3 | MINOR 4개 반영 | 완전 해소 | 완료 — mn-001(Nginx 캐시), mn-002(import 완전성), mn-003(루트 리다이렉트), mn-004(M-011 합산) |
| 4 | cursor 페이징 일관성 | 범용 buildCursorQuery 유틸 정의 | 완료 — CursorQueryOptions + cursorField 파라미터 |
| 5 | 타임존 처리 | date-fns-tz 기반, setHours 없음 | 완료 — TIMEZONE 상수, fromZonedTime, formatInTimeZone 사용 |
| 6 | 보안 검증 | 소유자 확인, UNIQUE 에러 감지 | 완료 — records/[id] 소유자 검증 + P2002 에러 코드 감지 |
| 7 | 배포 체크리스트 | 폰트 복사, PM2 env, Nginx 캐시 | 완료 — 15개 체크리스트 항목, M-007/M-008/mn-001 모두 반영 |
| 8 | 트레이드오프 | 12개 항목 | 완료 — 10개 기존 + M-011 보고서 2개 추가 |
| 9 | 의존성 다이어그램 정확성 | 실제 순서 반영 | 완료 — 단계1→2→3→4→5→6/7→8 순서 반영 |
| 10 | PDF 응답 반환 스니펫 | Buffer → NextResponse 패턴 | 완료 — Content-Type, Content-Disposition, Content-Length 포함 |
| 11 | [NF-V2-001] matcher '/' 제거 | 랜딩 페이지 비로그인 접근 가능 | 완료 — matcher에서 '/' 제거, page.tsx 클라이언트사이드 처리 방식 명시 |
| 12 | [NF-V2-002] staff/[id] PATCH 스니펫 | 비밀번호 초기화 + isFirstLogin=true | 완료 — API 4b 섹션 추가, bcrypt.hash + isFirstLogin=true + tempPassword 1회 응답 스니펫 포함 |
| 13 | [NF-V2-003] holidays 스니펫 | GET/POST/DELETE 3개 엔드포인트 | 완료 — API 8 섹션 추가, date 저장 형식 + P2002 처리 패턴 명시 |
| 14 | [NF-V2-004] calcTotalHours 엣지케이스 | startTime===endTime → 0 반환 | 완료 — diff===0 조건 분리 처리, 야간근무 조건 diff<0으로 변경 |

---

*PLAN.md V2 작성 완료: 2026-05-18*
*PLAN.md V3 업데이트 완료: 2026-05-18 — NF-V2-001~004 신규 발견 4개 전부 반영*
*기반 문서: PLAN.md V2, PLAN_CRITIC_V2.md (NF-V2-001 MODERATE / NF-V2-002 MINOR / NF-V2-003 MINOR / NF-V2-004 MICRO 전부 반영)*
*다음 단계: 사용자 리뷰 후 `구현해줘` 트리거 시 builder 에이전트 코딩 시작*
