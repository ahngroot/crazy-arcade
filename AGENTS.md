# Bubble Critter Duel

- 기존 체크아웃에서 작업한다. 클라우드 작업은 이미 격리되어 있으므로 사용자가 요청하지 않으면 worktree를 만들지 않는다.
- 단계별 계획을 따른다. 현재 범위는 1단계 기반 구축이다. 다음 단계는 명시적인 요청을 받고 진행한다.
- Node.js 24, npm workspaces, TypeScript strict, Phaser 4.2.1을 사용한다.
- `packages/shared`에는 DOM/Phaser 의존성이 없는 규칙과 타입을 둔다. 클라이언트는 표시와 입력, 서버는 최종 경기 판정을 담당한다.
- 미구현 기능을 완료로 표시하지 않는다. 원작의 확인된 사실과 임시 수치는 `docs/rules.md`에 구분한다.
- 에셋은 직접 만든 리소스만 사용한다. 비밀키와 생성 결과물을 커밋하지 않는다.
- 변경 후 `npm run typecheck`, `npm test`, `npm run build`를 실행한다. UI 변경은 `npm run test:e2e`로 확인한다.
- 현재 Phaser 장면은 표시 전용이다. 다음 단계에서 게임 엔진은 shared에 구현한다.
