# 브라우저에서 플레이할 주소 만들기

현재 Codex 환경에는 공개 포트 미리보기 기능이 없다. `render.yaml`은 Render의 무료 Web Service 하나에서 빌드한 화면과 Socket.IO를 함께 실행하기 위한 설정이다. 실제 배포와 주소 발급은 아직 완료하지 않았다.

1. https://render.com/deploy?repo=https://github.com/ahngroot/crazy-arcade 를 연다.
2. 본인의 Render 계정으로 로그인하고, 요청되면 GitHub 저장소 접근을 연결한다.
3. 서비스 요금제가 **Free**인지 확인한 뒤 Blueprint를 배포한다. 무료 요금제를 사용할 수 없다면 유료 전환 전에 중단하고 요금제를 확인한다.
4. 빌드가 끝나고 서비스가 Live가 되면 Render가 표시하는 HTTPS 주소를 연다. 주소는 실제 생성된 값을 사용한다.
5. 연습 모드 또는 꼬물이 대전으로 키보드 플레이한다. 온라인은 두 브라우저에서 같은 주소에 접속해 방 생성→코드 참가→양쪽 READY로 시작한다.

이 작업은 Codex 환경 설정의 Publish와 별개다. Render 계정 로그인은 사용자가 직접 진행하며 토큰이나 비밀번호를 채팅에 보낼 필요가 없다.

## 실행 설정

Node.js 24, 루트에서 `npm ci --include=dev && npm run build`, 시작은 `npm start`, 상태 확인은 `/health`다. 서버는 Render가 제공하는 `PORT`로 `0.0.0.0`에 바인딩한다. 브라우저와 Socket.IO가 같은 출처를 사용하므로 별도 서버 주소나 API 키 설정은 필요 없다. GitHub 푸시만으로 재배포되지 않도록 자동 배포를 끈다.

무료 서비스는 유휴 후 중지되거나 재시작할 수 있어 첫 접속이 늦어질 수 있다. 방·점수는 메모리에 있으므로 서버 재시작/재배포 시 사라진다. 장시간 안정적인 인터넷 대전과 실제 HTTPS/WebSocket 검증은 주소 발급 후 확인한다.
