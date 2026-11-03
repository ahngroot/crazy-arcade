# Bubble Critter Duel · 버블 크리터

`ahngroot/crazy-arcade`에서 개발하는 독자 리소스 기반 2인 아케이드 웹게임입니다. 현재 **1단계: 실행 기반과 시작 화면**까지 구현되어 있습니다. 아직 전투 게임이나 온라인 대전 완성본이 아닙니다.

## 실행

Node.js 24 LTS와 npm이 필요합니다. 저장소 루트에서:

```sh
npm ci
npm run dev
```

개발 클라이언트: `http://localhost:5173`, 서버 건강 검사: `http://localhost:3001/health`.
이 주소는 서버가 실행 중인 PC/클라우드 환경 안에서만 유효합니다. 클라우드의 localhost는 사용자 PC의 localhost와 다릅니다. 현재 외부 접속 주소는 배포하지 않았습니다.

Vite가 `/health`와 `/socket.io`를 서버로 프록시합니다. 개발 시 기본 포트 5173/3001을 사용하세요. 비밀키나 DB는 필요하지 않습니다.

## 검증 및 빌드

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

이미 Chromium이 설치된 Linux 환경에서는 `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`로 사용할 수 있습니다. E2E는 개발 서버를 자동 시작하고 종료하며 실제 캔버스 렌더링, 연결, 화면 전환과 좁은 화면 레이아웃을 검사합니다. 스크린샷은 `test-results/`에 생성됩니다.

빌드 후 `npm start`로 서버와 정적 클라이언트를 한 포트(기본 3001)에서 실행할 수 있습니다. 포트는 `PORT` 환경 변수로 설정합니다. `.env` 자동 로딩은 하지 않습니다. Socket.IO는 동일 출처 요청만 허용합니다. 실제 공개 서비스용 보안 검증은 7단계 범위입니다.

## 구성

| 경로            | 역할                                                    |
| --------------- | ------------------------------------------------------- |
| apps/client     | Vite + Phaser 시작 메뉴와 표시 전용 장면                |
| apps/server     | Express 건강 검사, Socket.IO 핸드셰이크, 정적 파일 제공 |
| packages/shared | 중앙 설정, 상태/입력 타입, 대칭 미리보기 맵             |
| tests           | Playwright 브라우저 검사                                |
| docs/rules.md   | 임시 수치, 원작 검증 상태, 단계별 범위                  |

연습 모드 버튼은 실제 렌더링 테스트 화면을 엽니다. 온라인 대전 버튼은 연결 상태와 미구현 기능을 안내합니다. 장면의 캐릭터와 물풍선은 직접 그린 벡터 그래픽이며 게임 판정은 없습니다.

다음 단계는 로컬 2인 조작(WASD/Space, 방향키/Enter), 이동·충돌·물풍선 폭발·아이템·갇힘/재생성입니다. 몬스터 경쟁은 3단계, 실제 온라인 방은 4단계, Docker/Render 배포는 7단계에 진행합니다.

## 현재 검증 결과

Node.js 24.19.0 환경에서 `npm ci`, 타입 검사, Vitest 3개, 빌드, Chromium Playwright 2개가 통과했습니다. 빌드된 서버의 `/health`와 HTML 제공도 확인했습니다. 실제 Windows Chrome/Edge와 인터넷 2인 대전은 아직 검증 대상 기능이 구현되지 않아 확인하지 않았습니다.

빌드에는 Phaser 엔진이 포함된 지연 로딩 청크(약 1.37MB, gzip 약 358KB)에 대한 크기 경고가 남습니다. 실행 실패는 아니며 추후 로딩 성능 최적화 대상으로 관리합니다.

## 다른 PC에서 이어서 개발

코드를 검토한 뒤 GitHub에 커밋·푸시해야 다른 PC에서 동일 변경 사항을 받을 수 있습니다. 이 작업만으로 원격 반영이나 배포가 자동 완료되지는 않습니다. 다른 PC에서 저장소를 clone/pull하고 Node.js 24로 `npm ci`, `npm run dev`를 실행하세요. 실행 중인 서버 프로세스는 Git에 저장되지 않습니다.
