# Aura Messenger

카카오톡 스타일의 1:1·그룹 채팅 메신저. React + tRPC + Socket.IO + Drizzle ORM + MySQL.

## 주요 기능

- 이메일/비밀번호 회원가입 및 로그인 (자체 인증, scrypt + JWT)
- 1:1 채팅 + 그룹 채팅
- 친구 목록, 즐겨찾기, 숨김, 차단
- 메시지 답장, 이모지 리액션, 길게 누르기 메뉴
- 메시지 삭제 (소프트 삭제)
- 채팅방 상단 고정, 알림 끄기, 나가기
- 프로필 편집 (이름, 상태 메시지)
- 다크 모드
- 실시간 입력 중 인디케이터, 읽음 표시
- 모바일 친화적 UI (`100dvh`, safe-area, 바텀시트, 하단 탭바)
- 이미지·파일 첨부 (로컬 파일 시스템 저장)

## 사전 준비

1. **Node.js 18+** 설치
2. **MySQL 8+** 설치 및 빈 DB 생성:
   ```sql
   CREATE DATABASE aura_messenger CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

## 설치 및 실행

```bash
# 1) 의존성 설치
npm install
# (또는 pnpm install)

# 2) 환경변수 파일 생성
cp .env.example .env
# .env 파일을 열어 DATABASE_URL, JWT_SECRET 채우기

# 3) 데이터베이스 마이그레이션
npm run db:push

# 4) 개발 서버 실행
npm run dev
# → http://localhost:3000
```

## 환경변수

`.env` 파일을 프로젝트 루트에 만들고 다음을 채우세요:

```env
# MySQL 연결 문자열
DATABASE_URL=mysql://root:비밀번호@localhost:3306/aura_messenger

# JWT 서명용 비밀키 (랜덤한 긴 문자열)
JWT_SECRET=change-me-to-a-long-random-string

# 선택 — 관리자로 자동 승격할 이메일
OWNER_EMAIL=

# 선택 — 서버 포트 (기본 3000)
PORT=3000
```

`JWT_SECRET`은 충분히 길고 무작위한 값을 쓰세요. 예시:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Vite HMR + tsx watch) |
| `npm run build` | 클라이언트·서버 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run check` | TypeScript 타입체크 |
| `npm run test` | Vitest 단위 테스트 |
| `npm run db:push` | 스키마 변경을 DB에 직접 적용 (개발용) |
| `npm run db:generate` | 마이그레이션 SQL 생성 |
| `npm run db:migrate` | 마이그레이션 적용 |
| `npm run format` | Prettier로 코드 포맷 |

## 파일 첨부 저장 위치

업로드한 이미지·파일은 프로젝트 루트의 `./uploads/` 디렉토리에 저장되며, Express가 `/uploads/*` 경로로 정적 서빙합니다.

운영 환경에서는 이 디렉토리를 영구 볼륨에 마운트하거나, `server/storage.ts`를 S3·R2 등으로 교체하세요.

## 디렉토리 구조

```
.
├── client/             # 프론트엔드 (React + Vite)
│   ├── index.html
│   └── src/
│       ├── components/ # ChatRoom, MessageBubble, ConversationList ...
│       ├── pages/      # LoginPage, MessengerPage
│       ├── hooks/      # useSocket
│       └── _core/hooks/useAuth.ts
├── server/             # 백엔드 (Express + tRPC + Socket.IO)
│   ├── _core/          # auth, context, cookies, env, vite ...
│   ├── routers/        # auth, chat, friends, users
│   ├── db.ts           # Drizzle 쿼리
│   ├── socket.ts       # Socket.IO 이벤트
│   └── storage.ts      # 파일 업로드 (로컬 디스크)
├── shared/             # 클라이언트·서버 공용 타입과 상수
└── drizzle/            # 스키마와 마이그레이션 SQL
```

## 트러블슈팅

- **`DATABASE_URL is required`** — `.env` 파일이 프로젝트 루트에 있는지 확인. `drizzle.config.ts`는 `dotenv/config`를 import해서 자동 로드합니다.
- **`'NODE_ENV'은(는) 내부 또는 외부 명령...` (Windows)** — `cross-env`가 dev dependency로 들어있으니 `npm install` 후 다시 시도하세요.
- **Windows에서 `npm install` 실패** — `npm install --legacy-peer-deps` 옵션으로 시도. (React 19 + `@emoji-mart/react`의 peer dep 충돌)
- **로그인 후 쿠키가 안 박힘** — 개발에선 HTTP라 `secure: false`로 자동 처리되고 `sameSite: lax`라 정상 작동합니다. 운영에선 반드시 HTTPS를 쓰세요.
- **WebSocket 연결 안 됨** — Vite dev proxy가 `/api` 경로를 백엔드(3000번 포트)로 프록시합니다. 브라우저는 5173(Vite)이 아니라 3000을 직접 열어야 통합 환경이 작동합니다.
