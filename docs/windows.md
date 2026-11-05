# Windows 포터블 EXE 배포

## 2026-11-05 온라인 전용 전환

- 제품 메뉴는 온라인 대전만 제공한다. 로컬 2인·무제한 연습과 클라이언트의 로컬 경기 실행 경로를 제거했다.
- 각 PC는 한 캐릭터만 조작한다. 빨강·초록 모두 방향키 이동, Space 물풍선, 양쪽 Ctrl 아이템이다. 보관 한도 2개와 획득 순서 사용은 유지한다.
- EXE 호스트는 같은 LAN의 상대 접속을 받는다. 초대 주소는 선택한 LAN IP와 화면의 포트를 사용하며, 상대는 브라우저로 참가한다.
- 타입 검사·빌드·Vitest 93개·Chromium E2E 14개 통과. 두 팀의 입력 분리, Ctrl 겹침/길게 누름, 초대 코드, 재접속·재대결·서버 재시작·좁은 화면·음향을 확인했다.
- Linux 포터블 파일을 Node/PATH 없는 한글 폴더에서 실행해 실제 소켓 2명과 브라우저 2명의 온라인 대전·방향키·Space·Ctrl을 확인했다. Windows ZIP은 별도로 생성하며 체크섬과 무결성을 검사한다.

이 클라우드의 Chromium은 사설 IP로 이동하면 네트워크 정책의 `Domain forbidden` 응답을 받는다. 여기서는 `PLAYWRIGHT_LOOPBACK_INVITES=1`, `PORTABLE_BROWSER_LOOPBACK=1`로 같은 서버의 루프백 주소에서 두 독립 브라우저를 검증했다. LAN 주소 생성·포트·전체 IPv4 바인딩을 확인했지만 이를 실제 PC 두 대의 LAN 실측으로 표시하지 않는다. Windows CI의 포터블 검사는 기본 설정으로 감지된 LAN 주소를 사용한다.

Windows 자동 빌드도 [실행 41958014533](https://github.com/ahngroot/crazy-arcade/actions/runs/41958014533)에서 성공했다(소스 `f374338`, 2분 13초). Windows에서 93개 테스트, EXE 생성, Node/PATH 없는 폴더에서 실제 실행, 두 브라우저 온라인 대전 검사를 통과하고 배포 파일과 화면 artifact를 생성했다. 실제 사용자 PC 두 대의 인터넷 회선 검증과는 구분한다.

공개 인터넷 서버는 계속 미배포 상태다. 아래 과거 단계/빌드 기록은 당시 기능과 검증 범위다.

**[Windows 게임 ZIP 바로 다운로드](https://github.com/ahngroot/crazy-arcade/raw/refs/heads/main/crazy-myangcade-windows-x64.zip)** — 저장소 루트에 배포 ZIP과 SHA-256을 직접 보관한다.

## 플레이하기

대상은 Windows 10/11 **x64**다. 플레이하는 PC에는 Node.js, npm, Git 설치가 필요하지 않다.

1. **호스트 PC 한 대**에서 위 배포 ZIP을 받고 압축 해제한다.
2. `crazy-myangcade.exe`를 더블클릭한다. 기본 브라우저에서 게임이 열린다.
3. **온라인 대전 → 닉네임 → 방 만들기**를 선택한다.
4. **초대 링크 복사**로 같은 공유기/LAN의 상대에게 주소를 보낸다. 상대는 브라우저로 주소를 열고 닉네임을 입력해 참가한다. 상대는 EXE를 실행하거나 Node를 설치할 필요가 없다.
5. 둘 다 **READY**를 누르면 경기가 시작한다. 각자 방향키·Space·Ctrl로 내 캐릭터만 조작한다.
6. 서버 창은 계속 켜 둔다. 종료는 서버 창 닫기 또는 Ctrl+C다. 브라우저 탭만 닫으면 서버는 계속 실행된다.

화면이 자동으로 열리지 않으면 서버 창의 `GAME_URL=http://127.0.0.1:...`을 직접 연다. 상대에게는 `FRIEND_URL` 또는 화면의 **상대 PC에서 열 주소**를 보낸다. 여러 주소가 표시되면 같은 공유기에 연결된 어댑터의 주소를 고른다. `localhost`/`127.0.0.1`은 각자의 PC를 가리킨다. 두 PC에서 따로 EXE를 켜면 서로 다른 서버가 만들어지므로 한 호스트의 주소를 함께 사용한다.

기본 포트는 3001이며 사용 중이면 빈 포트가 자동 배정된다. Windows에서 이전 localhost 전용 EXE와 포트가 겹치지 않도록 시작 전에 루프백 포트의 사용 여부도 확인한다. 표시되는 주소와 초대 링크에는 실제 포트가 반영된다. EXE는 `0.0.0.0`에 바인딩해 다른 PC의 연결도 받는다. Windows 방화벽에서 해당 앱이 사용하는 사설 네트워크의 연결을 허용해야 하며 공유기의 게스트/단말 격리가 켜져 있으면 접속하지 못할 수 있다. 프로그램이 방화벽이나 공유기 설정을 자동 변경하지는 않는다.

사용 아이템은 합계 2개, 획득 순서대로 Ctrl 한 번당 하나씩 사용한다. 왼쪽·오른쪽 Ctrl 모두 같은 내 캐릭터에 적용되며, 두 키를 겹쳐 누르거나 길게 눌러도 중복 소비하지 않는다. WASD·Enter와 한 PC의 로컬 2인/연습 모드는 제거했다. 소리는 게임 안의 **소리 켜기**로 활성화한다.

EXE를 다른 폴더로 옮겨도 화면·소리는 내장되어 있다. 게임 방과 점수는 서버 종료 시 사라진다. **서로 다른 집의 두 PC가 접속하려면 공통 서버 주소가 필요하며, 인터넷 공개 서버는 아직 배포하지 않았다.**

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

라이선스 묶음은 Node.js 공식 LICENSE와 서버·클라이언트의 production npm 의존성 라이선스를 포함한다. 사용자 요청에 따라 루트 배포 ZIP과 체크섬만 Git에 보관한다. 그 외 생성 파일과 다운로드 캐시는 Git에 넣지 않는다.

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

검사는 실행 파일만 공백·한글이 있는 임시 폴더로 옮기고, 자식 프로세스의 Node/PATH를 비운 뒤 실행한다. 내장 HTML/JS/CSS, 실제 소켓 2명 입장·경기·점수/시간 일치·서버 Ctrl 사용과 두 브라우저의 온라인 경기·방향키·Space·Ctrl FIFO·상대 캐릭터 분리를 확인한다. 검사가 끝나면 테스트 프로세스를 종료하고 임시 파일을 정리한다. 화면은 `test-results/portable/game.png`에 생성된다.

자동 검사는 `--no-browser --port 0`으로 시작하고 테스트 브라우저를 별도로 조작한다. EXE 더블클릭 시 기본 브라우저 열기·실제 사용자 키보드·Windows 실행 확인 화면은 사용자 PC에서 추가 확인할 항목이다.

### 이전 Windows 빌드 확인 기록 (2026-11-04)

2026-11-04, Windows x64 PE 실행 파일과 ZIP을 Linux에서 크로스 빌드했다. 같은 SEA 구조의 Linux 파일은 Node.js가 PATH에 없는 분리된 폴더에서 실제 실행했고, 내장 화면·2인 소켓·Ctrl 사용·브라우저 플레이를 확인했다. Windows 실행 파일의 형식, 공식 런타임 체크섬, ZIP 무결성을 검사했다.

타입 검사·제품 빌드·전체 테스트 90개가 통과했다. Windows EXE는 약 93MB, 배포 ZIP은 약 35MB다. PE import 검사에서 Windows 기본 시스템 DLL만 참조하며 별도 Node 설치 파일을 요구하지 않는 구성을 확인했다.

Windows 러너의 [첫 자동 빌드](https://github.com/ahngroot/crazy-arcade/actions/runs/41798446967)도 **성공**했다(소스 `1999cf3`, 약 2분 5초). Windows에서 실제 EXE를 생성하고 Node/PATH 없는 한글 폴더에서 실행해 내장 화면·2인 소켓·Ctrl 사용·브라우저 플레이를 검사한 후 artifact 2개를 업로드했다. 이 기록은 이전 로컬 모드 버전의 자동 검증이다. 현재 버전 다운로드는 문서 상단의 저장소 ZIP 링크를 사용한다.

이 결과는 자동 Windows 실행 검사이며, 사용자의 Windows PC에서 더블클릭·기본 브라우저 열기·키보드·미확인 앱 안내를 직접 확인한 것으로 표시하지 않는다.
