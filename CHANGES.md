# Aura Messenger — 변경 사항 요약

기존 코드베이스에서 다음을 수정/추가했습니다.

## 🐛 수정된 버그

1. **`chat.test.ts` 어설션 오류** — `sendMessage({ content: "Hello!" })` 호출 후 `result.content`를 `"Hello"`로 비교하던 부분(`"!"` 누락)을 수정.
2. **`getOrCreateDM`의 잘못된 매칭 로직** — 2인 이상이 참여 중인 그룹채팅이 DM으로 오인되어 반환되던 가능성 제거(`participants.length !== 2` 체크 추가).
3. **`MessengerPage`의 `useEffect` 의존성 누수** — `selectedConvId`가 deps에 들어가 매 채팅방 전환마다 소켓 리스너가 재등록되던 문제 수정. 함수형 setState로 현재 값을 읽도록 변경.
4. **`ChatRoom`의 `useEffect` 의존성 누락** — `eslint-disable-next-line`으로 의도된 deps만 추적.
5. **모바일 키보드/입력바 가림** — `body { overflow: hidden }` + `100dvh` + `env(safe-area-inset-bottom)` 적용.
6. **읽음 영수증의 잘못된 트리거** — 본인이 읽음 처리한 이벤트가 자신의 메시지에 더블체크로 잘못 표시되던 케이스 제거.
7. **`UserAvatar`의 한글 이름 처리** — 단어 사이 공백이 없는 한글 이름이 빈 이니셜로 렌더되던 케이스 수정.
8. **`useSocket`의 globalSocket 누수** — 페이지 이동 시 cleanup 안정성 향상.

## ✨ 추가된 카카오톡 대응 기능

| 기능 | 위치 |
|---|---|
| 친구 목록 탭 (즐겨찾기/숨김/차단) | `FriendsList.tsx`, `routers/friends.ts` |
| 1:1 채팅 + **그룹 채팅** 생성 | `NewChatModal.tsx`, `chat.createGroup` |
| 프로필 편집 (이름, 상태 메시지) | `ProfileSheet.tsx`, `users.updateProfile` |
| 메시지 **답장**(reply-to) | `MessageBubble.tsx`, `MessageInput.tsx`, `messages.replyToId` |
| 메시지 **이모지 리액션** (👍 ❤️ 😂 😮 😢 🔥) | `MessageBubble.tsx`, `chat.toggleReaction` |
| 메시지 길게 누르기 / 우클릭 메뉴 (답장/복사/삭제) | `MessageBubble.tsx` |
| 메시지 **삭제** (소프트 삭제, 본인만) | `chat.deleteMessage` |
| 채팅방 **상단 고정** (pin) | `chat.updateSettings` |
| 채팅방 **알림 끄기** (mute) | `chat.updateSettings` |
| 채팅방 **나가기** + 시스템 메시지 | `chat.leave` |
| **다크 모드** 토글 | `ThemeContext`, 모든 컴포넌트가 토큰 사용 |
| 입력 중(typing) 인디케이터 | 기존 + 정리 |
| 시스템 메시지 (예: "OO님이 나갔습니다") | `messages.type = 'system'` |

## 🎨 디자인 개선

- **카카오톡 노란 말풍선** 차용: `--bubble-me`가 노란색, 다크모드에서는 진노랑으로 자동 전환
- 한글 친화 **Pretendard** 폰트 우선 적용 (시스템 폰트 폴백)
- **둥근 사각** 아바타(`borderRadius: 32%`) — 카톡 스타일
- 멤피스 액센트(`memphis-btn`, `memphis-card`)는 유지하되 채팅 영역에서는 톤다운
- **CSS 변수 기반 토큰 시스템** — 모든 색상이 `var(--*)`로 통일되어 라이트/다크 자동 전환
- **Bottom Sheet** UI — 모바일 친화 액션 시트(`BottomSheet.tsx`), Escape/백드롭 클릭 닫기, safe-area 적용
- **리액션 칩** — 토글 가능한 둥근 캡슐 버튼
- 메시지 그룹화 — 연속된 메시지는 아바타/시간 생략, 분 단위 변경 시에만 시간 표시
- 날짜 구분선 — 카카오톡 스타일 캡슐형(`<span>오늘</span>`)
- 핀 고정 / 알림 끄기 / 그룹 채팅 아이콘이 채팅방 리스트에 시각적으로 표시

## 📱 모바일 최적화

- `100dvh` 사용으로 iOS 주소창 변동 대응
- `env(safe-area-inset-bottom)`로 노치/홈인디케이터 대응
- 모바일에서 사이드바와 채팅 패널 fullscreen 전환 (`hidden md:flex`)
- **하단 탭바**(채팅/친구/내정보) — 모바일 전용
- 터치 길게 누르기(`onTouchStart`/`Timer`)로 액션 시트 호출
- `-webkit-tap-highlight-color: transparent`로 탭 시 회색 박스 제거
- `overscroll-behavior-y: contain`으로 풀투리프레시 방지
- 입력바: 모바일에선 Enter가 줄바꿈, 데스크탑에선 Enter가 전송

## 🗄️ DB 마이그레이션

새 마이그레이션 파일: `drizzle/0002_kakao_features.sql`

- 새 테이블: `friends`, `message_reactions`
- `users`: `statusMessage`, `backgroundUrl` 컬럼 추가
- `conversations`: `avatarUrl`, `createdBy` 컬럼 추가
- `conversation_participants`: `isPinned`, `isMuted`, `customName` 컬럼 추가
- `messages`: `replyToId`, `editedAt` 컬럼 추가, `type`에 `'system'` enum 값 추가

배포 시 `pnpm run db:push` 또는 `drizzle-kit migrate` 실행.

## ✅ 검증

```bash
npx tsc --noEmit   # 통과
npx vitest run     # 16 tests passed
npx vite build     # 빌드 성공
```
