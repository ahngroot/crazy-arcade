# Bubble Critter Duel

- 기존 체크아웃에서 작업한다. 클라우드 작업은 이미 격리되어 있으므로 사용자가 요청하지 않으면 worktree를 만들지 않는다.
- 단계별 계획을 따른다. 현재 범위는 6단계 버그·성능 검증이다. 다음 단계는 명시적인 요청을 받고 진행한다.
- 사용자의 합의에 따라 단계 완료 시 검증 후 커밋하고 `git push origin HEAD:main`으로 GitHub에 반영한다. 푸시 전에 원격 변경 여부를 확인하며, 강제 푸시하지 않는다. 공개 배포는 별도 단계다.
- Node.js 24, npm workspaces, TypeScript strict, Phaser 4.2.1을 사용한다.
- `packages/shared`에는 DOM/Phaser 의존성이 없는 규칙과 타입을 둔다. 클라이언트는 표시와 입력, 서버는 최종 경기 판정을 담당한다.
- 미구현 기능을 완료로 표시하지 않는다. 원작의 확인된 사실과 임시 수치는 `docs/rules.md`에 구분한다.
- 에셋은 직접 만든 리소스만 사용한다. 비밀키와 생성 결과물을 커밋하지 않는다.
- 변경 후 `npm run typecheck`, `npm test`, `npm run build`를 실행한다. UI 변경은 `npm run test:e2e`로 확인한다.
- 게임 엔진은 `packages/shared/src/game.ts`, 입력과 렌더링은 `apps/client/src/practice.ts`에 분리한다. 고정 스텝을 유지하고 렌더러의 보정된 delta로 게임 시간이 느려지지 않도록 한다.
- `packages/shared/src/competition.ts`는 몬스터·생성 대기열·점수·승패를 담당한다. 2단계 무제한 연습과 3단계 제한시간 대전을 모두 유지한다. 밸런스는 GAME_CONFIG에서 관리한다.
- 온라인 판정은 `apps/server/src/rooms.ts`에서 공통 엔진을 호출한다. 클라이언트 `online.ts`는 방/세션 UI, `netcode.ts`는 이동 예측·승인 보정·보간만 담당한다. 서버 인증 토큰을 로그나 공유 스냅샷에 넣지 않는다. 온라인 규칙 및 실행/검증은 `docs/online.md`를 따른다.
- 그래픽 원본은 `apps/client/src/art.ts`, 표시 전용 리소스/효과는 `renderer.ts`, 상태 차분 관찰은 `presentation.ts`, 오리지널 Web Audio 합성은 `audio.ts`에 둔다. 판정이나 서버 상태를 연출 때문에 변경하지 않는다. 개발용 `showcase.ts`는 시각 검사 전용이며 제품 메뉴에 연결하지 않는다.
- 소리는 기본 꺼짐과 사용자 제스처 제한을 유지하고, 세션 종료/탭 숨김에 예약 음악·노드를 정리한다. 그래픽/사운드 변경은 `docs/art-and-sound.md`와 생성 샘플의 검증 범위를 함께 확인한다.
- QA 재현과 성능 측정은 `docs/qa.md`와 `npm run benchmark`를 따른다. 테스트용 조건과 실제 인터넷/Windows/GPU 측정을 구분하고, 헤드리스 측정으로 일반 PC의 60FPS를 보장하지 않는다.
