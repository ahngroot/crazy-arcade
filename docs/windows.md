# Windows 포터블 EXE 배포

## 플레이하기

대상은 Windows 10/11 **x64**다. 플레이하는 PC에는 Node.js, npm, Git 설치가 필요하지 않다.

1. `crazy-myangcade-windows-x64.zip` 또는 GitHub Actions의 `crazy-myangcade-windows-x64` artifact를 받는다.
2. ZIP을 압축 해제한다. GitHub의 Code → Download ZIP은 실행 파일이 없는 소스 코드이므로 구분한다.
3. `crazy-myangcade.exe`를 더블클릭한다.
4. 기본 브라우저에 게임이 열린다. 서버 창을 켜 둔 상태로 플레이한다.
5. 끝나면 서버 창을 닫거나 Ctrl+C를 누른다. 브라우저 탭만 닫으면 서버는 계속 실행된다.

화면이 자동으로 열리지 않으면 서버 창의 `GAME_URL=http://127.0.0.1:...` 주소를 브라우저에 직접 입력한다. 기본 포트는 3001이며, 사용 중이면 빈 포트가 자동 배정된다. EXE를 다른 폴더로 옮겨도 게임 그림·소리는 EXE에 내장되어 있다. 브라우저 설정은 같은 주소의 브라우저 저장소에 보관되며, 게임 방과 점수는 서버 창을 닫으면 사라진다.

로컬 조작: P1 WASD·Space·왼쪽 Ctrl, P2 방향키·Enter·오른쪽 Ctrl. 사용 아이템은 합계 2개, 획득 순서대로 한 번씩 사용한다. 소리는 게임 안에서 소리 켜기를 누른다. 같은 PC의 별도 브라우저로 온라인 방도 테스트할 수 있다.

이 EXE 서버는 **127.0.0.1에만** 열리므로 다른 PC나 인터넷에서는 접속할 수 없다. 같은 LAN의 다른 PC와 플레이하려면 기존 소스 서버의 실행 방법을 따른다. 인터넷 공개 서비스는 별도 배포가 필요하다.

코드 서명 인증서가 없는 테스트 빌드라 Windows에서 미확인 앱 안내가 표시될 수 있다. 런타임은 공식 Node.js 배포 파일을 체크섬 검증 후 포함하며, 게임으로 변경한 EXE에는 원본 Node 서명이 적용되지 않는다.

## GitHub에서 받기

[Windows portable EXE](https://github.com/ahngroot/crazy-arcade/actions/workflows/windows-portable.yml)를 열고 성공한 실행의 **Artifacts → crazy-myangcade-windows-x64**를 받는다. 저장소 접근 권한과 로그인이 필요할 수 있다. artifact는 7일간 보관하며, 만료되면 Actions에서 Run workflow로 다시 생성한다. Actions가 비활성화되었거나 실행이 실패하면 새 EXE artifact가 생성되지 않는다.

워크플로는 Windows 러너에서 설치·타입 검사·테스트·실제 EXE 생성·EXE 서버와 브라우저 플레이 검사를 마친 뒤 결과물을 올린다. 소스와 패키지 변경이 main에 반영되면 자동 실행되며, 수동 실행도 가능하다. 공개 웹사이트를 만들거나 서버에 게임을 배포하는 작업은 하지 않는다.

## 개발자가 직접 만들기

제작 PC에는 Node.js 24.x, npm, curl이 필요하다. 실행하는 사용자는 필요 없다. 저장소 루트에서:

```sh
npm ci
npm run typecheck
npm test
npm run package:windows
```

Linux 또는 Windows에서 Windows x64 파일을 생성할 수 있다. 제작에 사용한 정확한 Node 버전의 공식 Windows ZIP을 nodejs.org에서 내려받고 `SHASUMS256.txt`와 SHA-256을 대조한다. 다운로드 캐시는 `.cache/portable/`에 보관한다. 크로스 빌드에서는 플랫폼 의존 코드 캐시와 스냅샷을 비활성화한다.

| 결과물                                    | 용도                                        |
| ----------------------------------------- | ------------------------------------------- |
| `release/crazy-myangcade.exe`             | 런타임·서버·화면을 포함한 실행 파일         |
| `release/crazy-myangcade-windows-x64.zip` | EXE·시작하기·라이선스를 포함한 배포 ZIP     |
| `release/windows-x64/`                    | CI가 ZIP artifact로 제공하는 동일 파일 묶음 |
| `release/SHA256SUMS.txt`                  | 실행 파일·배포 ZIP의 SHA-256                |
| `build/portable/`                         | 번들·SEA 설정·blob 중간 결과                |

라이선스 묶음은 Node.js 공식 LICENSE와 서버·클라이언트의 production npm 의존성 라이선스를 포함한다. 생성 파일과 다운로드 캐시는 Git에 넣지 않는다.

## 실행 검증

Windows 제작 후:

```sh
npx playwright install chromium
npm run test:portable -- release/crazy-myangcade.exe
```

Linux에서는 동일한 로직의 호스트 실행 파일로 검사한다.

```sh
npm run package:host
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:portable -- release/crazy-myangcade-linux
```

검사는 실행 파일만 공백·한글이 있는 임시 폴더로 옮기고, 자식 프로세스의 Node/PATH를 비운 뒤 실행한다. 내장 HTML/JS/CSS, 실제 소켓 2명 입장·경기·점수/시간 일치·서버 Ctrl 사용과 브라우저의 로컬 경기·Ctrl FIFO를 확인한다. 검사가 끝나면 테스트 프로세스를 종료하고 임시 파일을 정리한다. 화면은 `test-results/portable/game.png`에 생성된다.

자동 검사는 `--no-browser --port 0`으로 시작하고 테스트 브라우저를 별도로 조작한다. EXE 더블클릭 시 기본 브라우저 열기·실제 사용자 키보드·Windows 실행 확인 화면은 사용자 PC에서 추가 확인할 항목이다.

### 이번 작업의 확인 범위

2026-11-04, Windows x64 PE 실행 파일과 ZIP을 Linux에서 크로스 빌드했다. 같은 SEA 구조의 Linux 파일은 Node.js가 PATH에 없는 분리된 폴더에서 실제 실행했고, 내장 화면·2인 소켓·Ctrl 사용·브라우저 플레이를 확인했다. Windows 실행 파일의 형식, 공식 런타임 체크섬, ZIP 무결성을 검사했다.

타입 검사·제품 빌드·전체 테스트 90개가 통과했다. Windows EXE는 약 93MB, 배포 ZIP은 약 35MB다. PE import 검사에서 Windows 기본 시스템 DLL만 참조하며 별도 Node 설치 파일을 요구하지 않는 구성을 확인했다.

Windows 러너의 [첫 자동 빌드](https://github.com/ahngroot/crazy-arcade/actions/runs/41798446967)도 **성공**했다(소스 `1999cf3`, 약 2분 5초). Windows에서 실제 EXE를 생성하고 Node/PATH 없는 한글 폴더에서 실행해 내장 화면·2인 소켓·Ctrl 사용·브라우저 플레이를 검사한 후 artifact 2개를 업로드했다. 다운로드는 해당 실행의 `crazy-myangcade-windows-x64` artifact를 사용한다.

이 결과는 자동 Windows 실행 검사이며, 사용자의 Windows PC에서 더블클릭·기본 브라우저 열기·키보드·미확인 앱 안내를 직접 확인한 것으로 표시하지 않는다.
