# crazy myangcade · 크레이지 먕케이드

- 바늘·쉴드는 공통 상자에서 드롭되는 액티브이며 획득만으로 사용하지 않는다. 합계 2칸 FIFO Ctrl로 사용하고, 바늘은 갇혔을 때 탈출, 쉴드는 4초 보호다. 사용자 첨부 기반 active-items.png를 바닥/슬롯/안내에 공통 사용한다.

- 최신 규칙: 연습·온라인·재시작 모두 아이템 없이 시작한다. 갇힘은 5초, 갇힌 이동속도는 능력치와 관계없이 기본속도×0.4이며 설치·획득은 금지한다. 사망 연출 후 기존 재생성은 유지한다. 액체·롤러·울트라는 획득 즉시 영구 강화하며 보관 칸과 Ctrl를 쓰지 않는다. 울트라는 물줄기를 최대로 올린다. 장갑·신발·고스트는 테스트 동안 드롭/제품 안내에서 제외하고 구현만 보존한다. docs/rules.md 최신 규칙을 따른다.

- 기존 체크아웃에서 작업한다. 클라우드 작업은 이미 격리되어 있으므로 사용자가 요청하지 않으면 worktree를 만들지 않는다.
- 현재 게임 이름은 crazy myangcade / 크레이지 먕케이드다. 사용자 요청에 따라 사용 아이템은 합계 2개, 획득 순서대로 Ctrl로 하나씩 사용한다. 현재 제품은 1인 무제한 연습과 각자 PC에서 한 캐릭터를 조작하는 온라인 1:1을 지원한다. 이동은 방향키, 물풍선은 Space, 아이템은 양쪽 Ctrl이다. 한 PC의 로컬 2인 플레이만 제거한다. 1인 연습 모드는 반드시 유지한다. 능력치 강화는 획득 즉시 적용한다.
- 시작과 초기화·재대결에는 중앙 3→2→1→Game Start! 연출을 사용한다. 카운트다운 중에는 이동·물풍선·아이템과 경기 시뮬레이션을 진행하지 않는다. 온라인 시간은 서버의 카운트다운을 따른다.
- 1인 연습은 중앙 분리벽 없는 일반 대결형 맵(`createBattleMap`, `terrain: battle`)과 전용 바닥·기둥·색상 블록을 사용한다. 온라인 꼬물이 맵과 구분한다.
- Render 설정은 준비만 되어 있다. EXE는 같은 LAN의 두 PC 접속을 지원한다. 인터넷 공개 배포는 별도 요청 없이 진행하지 않는다.
- Windows 포터블 EXE는 `npm run package:windows`, 실행 검증은 `npm run test:portable`을 따른다. `docs/windows.md`에 사용법과 검증 범위를 기록한다. SEA의 Node 버전은 blob 생성 런타임과 같아야 하며 Windows 다운로드의 SHA-256을 검증한다. `release/`, `build/`, `.cache/`와 EXE/ZIP은 Git에 커밋하지 않고 CI artifact로 제공한다. Linux 실행 검증을 Windows 실기기 검증으로 표시하지 않는다.
- 사용자의 합의에 따라 단계 완료 시 검증 후 커밋하고 `git push origin HEAD:main`으로 GitHub에 반영한다. 푸시 전에 원격 변경 여부를 확인하며, 강제 푸시하지 않는다. 공개 배포는 별도 단계다.
- Node.js 24, npm workspaces, TypeScript strict, Phaser 4.2.1을 사용한다.
- `packages/shared`에는 DOM/Phaser 의존성이 없는 규칙과 타입을 둔다. 클라이언트는 표시와 입력, 서버는 최종 경기 판정을 담당한다.
- 미구현 기능을 완료로 표시하지 않는다. 원작의 확인된 사실과 임시 수치는 `docs/rules.md`에 구분한다.
- 에셋은 직접 만든 리소스만 사용한다. 비밀키와 생성 결과물을 커밋하지 않는다.
- 변경 후 `npm run typecheck`, `npm test`, `npm run build`를 실행한다. UI 변경은 `npm run test:e2e`로 확인한다.
- 게임 엔진은 `packages/shared/src/game.ts`, 입력과 렌더링은 `apps/client/src/game.ts`에 분리한다. 고정 스텝을 유지하고 렌더러의 보정된 delta로 게임 시간이 느려지지 않도록 한다.
- `packages/shared/src/competition.ts`는 몬스터·생성 대기열·점수·승패를 담당한다. 1인 연습은 클라이언트의 공통 엔진으로 실행하고 온라인 제한시간 대전은 서버가 판정한다. 공통 엔진의 검증용 상태 생성 함수와 규칙 테스트는 유지한다. 밸런스는 GAME_CONFIG에서 관리한다.
- 온라인 판정은 `apps/server/src/rooms.ts`에서 공통 엔진을 호출한다. 클라이언트 `online.ts`는 방/세션 UI, `netcode.ts`는 이동 예측·승인 보정·보간만 담당한다. 서버 인증 토큰을 로그나 공유 스냅샷에 넣지 않는다. 온라인 규칙 및 실행/검증은 `docs/online.md`를 따른다.
- 그래픽 원본은 `apps/client/src/art.ts`, 표시 전용 리소스/효과는 `renderer.ts`, 상태 차분 관찰은 `presentation.ts`, 오리지널 Web Audio 합성은 `audio.ts`에 둔다. 판정이나 서버 상태를 연출 때문에 변경하지 않는다. 개발용 `showcase.ts`는 시각 검사 전용이며 제품 메뉴에 연결하지 않는다.
- 소리는 기본 꺼짐과 사용자 제스처 제한을 유지하고, 세션 종료/탭 숨김에 예약 음악·노드를 정리한다. 그래픽/사운드 변경은 `docs/art-and-sound.md`와 생성 샘플의 검증 범위를 함께 확인한다.
- QA 재현과 성능 측정은 `docs/qa.md`와 `npm run benchmark`를 따른다. 테스트용 조건과 실제 인터넷/Windows/GPU 측정을 구분하고, 헤드리스 측정으로 일반 PC의 60FPS를 보장하지 않는다.
- 실행·인수인계는 `docs/handoff.md`, 원작 비교와 조정 가능한 밸런스 항목은 `docs/original-comparison.md`를 따른다. 8단계 정리를 마쳐도 공개 배포·실제 Windows/인터넷 검증·원작 실측까지 완료된 것으로 표시하지 않는다.

- 사용자 요청에 따라 저장소 루트의 `crazy-myangcade-windows-x64.zip`과 `.zip.sha256`은 배포용으로 커밋한다. 이 두 파일은 생성 결과물 제외 규칙의 명시적 예외다. 나머지 `release/`, `build/`, `.cache/`는 계속 제외한다. 새 배포 ZIP 갱신 시 무결성과 체크섬, README 다운로드 링크를 확인한다.
