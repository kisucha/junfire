# JunFire Protection — Advisor 워크플로우 (프로젝트 특화 에스컬레이션 조건)

| 항목 | 내용 |
|------|------|
| Document Name | Advisor Workflow |
| Version | V1 |
| Date | 2026-05-18 |
| Author | kisucha |
| Document Type | 에스컬레이션 운영 지침 |
| Model Used | claude-sonnet-4-6 |

> 글로벌 공통 에스컬레이션 규칙(ESC-001~005)은 `~/.claude/CLAUDE.md` 참조.
> 이 파일은 JunFire 프로젝트 특화 추가 조건만 정의.

---

## 프로젝트 특화 에스컬레이션 추가 조건

| 코드 | 조건 | 설명 |
|------|------|------|
| `JF-ESC-001` | 권한 설계 변경 필요 | EMPLOYEE/ADMIN 외 역할 추가 요구 발생 시 |
| `JF-ESC-002` | 날짜 상태 로직 충돌 | 동일 날짜에 복수 상태 입력 시나리오 발생 시 |
| `JF-ESC-003` | PDF 생성 성능 이슈 | 대용량 기간 조회 시 타임아웃 발생 가능성 탐지 시 |
| `JF-ESC-004` | 자체 서버 배포 제약 | PM2/Nginx 설정이 Next.js 기능과 충돌 시 |
| `JF-ESC-005` | 한국어 폰트 미지원 | PDF 내 한글 렌더링 불가 상황 발생 시 |

---

## Advisor 응답 구조 (표준 v1)

글로벌 CLAUDE.md 4~5절 템플릿 적용.  
`~/.claude/guides/escalation_templates.md` 파일 참조.

---

## 에이전트별 에스컬레이션 권한

| 에이전트 | 에스컬레이션 가능 조건 |
|---------|----------------------|
| researcher | ESC-001, ESC-002 |
| planner | ESC-001, ESC-002, ESC-003, JF-ESC-001, JF-ESC-002 |
| builder | ESC-002, ESC-003, ESC-005, JF-ESC-003, JF-ESC-004, JF-ESC-005 |
| reviewer | ESC-003, JF-ESC-001 |
| critic | ESC-002, ESC-003 |
| historian | 에스컬레이션 없음 (기록 전담) |

---

## 최대 에스컬레이션 횟수

동일 이슈 최대 2회 → 3회째는 사용자에게 직접 보고. (글로벌 규칙 동일)
