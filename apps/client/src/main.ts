import { io, type Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@bubble/shared";
import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="shell">
    <header class="topbar"><a class="brand" href="/" aria-label="버블 크리터 홈"><span class="brand-icon">b.</span><span>BUBBLE CRITTER<small>작은 친구들, 커다란 한 판.</small></span></a><span class="build-tag">DEVELOPMENT <b>01 / 08</b></span></header>
    <main>
      <div class="eyebrow"><span></span> THE LITTLE ARCADE CLUB</div>
      <section class="intro"><div><h1>작은 물방울로,<br />시작하는 큰 모험<span>.</span></h1><p>톡, 놓고 · 쏙, 피하고 · 팡, 터뜨려요.<br />둘이 함께할 새로운 아케이드, 버블 크리터.</p></div><div class="intro-note"><span>✳</span><p>A LITTLE SPLASH.<br />A LOT OF FUN.</p></div></section>
      <section class="game-layout" aria-label="게임 시작">
        <div class="arena-card"><div class="arena-top"><span><i></i> CLOVER GARDEN</span><span>맵 미리보기 <b>01</b></span></div><div class="arena-wrap"><div id="arena" role="img" aria-label="빨강과 초록 진영, 캐릭터와 물풍선이 있는 대칭형 정원 맵"></div><div class="preview-label">PHASER 4 · LIVE PREVIEW</div></div><div class="arena-bottom"><span><i class="red-dot"></i> RED TEAM</span><span>작은 정원에서 만나요</span><span><i class="green-dot"></i> GREEN TEAM</span></div></div>
        <aside class="menu-card"><span class="section-number">LET’S GET STARTED</span><h2>어떻게 시작할까요?</h2><p class="menu-caption">첫 번째 정원을 둘러보세요.</p>
          <button id="practice" class="mode primary"><span class="mode-icon">✳</span><span><strong>연습 모드</strong><small>렌더링 테스트 화면 열기</small></span><span class="arrow">↗</span></button>
          <button id="online" class="mode secondary"><span class="mode-icon">◎</span><span><strong>온라인 대전</strong><small>개발 안내 · 서버 연결 확인</small></span><span class="arrow">↗</span></button>
          <div class="stage-note"><span>지금은 첫 번째 단계예요</span><p>시작 화면과 게임 실행 기반을 준비했어요.<br />이동과 물풍선 플레이는 다음 단계에 만나요.</p></div>
          <div class="connection"><span id="connection-dot"></span><span id="connection" role="status">서버 연결 중…</span><span>DEV 0.1</span></div>
        </aside>
      </section>
      <section class="bottom-grid"><div><span class="detail-icon">⌘</span><div><h3>간단한 조작, 즐거운 대결</h3><p>이동 <kbd>W A S D</kbd> 물풍선 <kbd>SPACE</kbd><small>다음 단계에서 지원할 조작법</small></p></div></div><div><span class="detail-icon">❋</span><div><h3>우리만의 작은 친구들</h3><p>직접 만든 캐릭터와 밝은 정원.<br />새로운 버블 세계를 함께 만들어가요.</p></div></div><div><span class="detail-icon">↗</span><div><h3>두 사람을 위한 아케이드</h3><p>방 코드로 만나는 1:1 대전.<br />온라인 플레이는 4단계에서 준비됩니다.</p></div></div></section>
    </main><footer><span>BUBBLE CRITTER DUEL © 2026</span><span>독자 리소스로 만드는 비공식 아케이드 프로젝트</span></footer>
  </div>
  <dialog id="practice-dialog" aria-labelledby="practice-title"><div class="dialog-header"><div><span class="section-number">PRACTICE · ENGINE PREVIEW</span><h2 id="practice-title">첫 번째 정원</h2></div><button class="close" aria-label="연습 화면 닫기">×</button></div><p>Phaser 렌더링 테스트입니다. 캐릭터 대기 모션과 맵을 확인할 수 있어요.<br />이동 · 물풍선 설치 · 전투는 아직 구현되지 않았습니다.</p><div id="practice-arena"></div><button class="back">메뉴로 돌아가기</button></dialog>
  <dialog id="online-dialog" aria-labelledby="online-title"><div class="dialog-header"><div><span class="section-number">ONLINE · COMING IN STAGE 04</span><h2 id="online-title">함께할 준비를 하고 있어요</h2></div><button class="close" aria-label="온라인 안내 닫기">×</button></div><p>현재는 서버 연결 기반만 동작합니다.<br />방 생성, 코드 입장, READY, 온라인 대전은 4단계에서 구현합니다.</p><div class="online-status" id="online-status" role="status">연결 상태 확인 중…</div><button class="back">확인했어요</button></dialog>
`;

const socket: Socket<ServerEvents, ClientEvents> = io({ timeout: 5000 });
function connection(ready: boolean) {
  document.querySelector("#connection")!.textContent = ready
    ? "개발 서버 연결됨"
    : "서버 연결 끊김 · 재연결 중";
  document
    .querySelector("#connection-dot")!
    .classList.toggle("connected", ready);
  document.querySelector("#online-status")!.textContent = ready
    ? "● Socket.IO 연결 확인 · 게임방 기능은 준비 중"
    : "○ 서버에 연결할 수 없습니다. 개발 서버 실행 상태를 확인하세요.";
}
socket.on("hello", (message) => connection(message.protocol === 1));
socket.on("disconnect", () => connection(false));
socket.on("connect_error", () => connection(false));

let preview: { destroy: (removeCanvas: boolean) => void } | undefined;
let previewGeneration = 0;
const sceneModule = import("./scene");
sceneModule
  .then(({ mountPreview }) => mountPreview(document.querySelector("#arena")!))
  .catch(() => {
    document.querySelector("#arena")!.textContent =
      "화면을 불러오지 못했습니다. 새로고침해 주세요.";
  });
for (const mode of ["practice", "online"]) {
  const dialog = document.querySelector<HTMLDialogElement>(`#${mode}-dialog`)!;
  document.querySelector(`#${mode}`)!.addEventListener("click", async () => {
    dialog.showModal();
    if (mode === "practice") {
      const generation = ++previewGeneration;
      try {
        const { mountPreview } = await sceneModule;
        if (dialog.open && generation === previewGeneration)
          preview = mountPreview(document.querySelector("#practice-arena")!);
      } catch {
        document.querySelector("#practice-arena")!.textContent =
          "렌더러를 불러오지 못했습니다.";
      }
    }
  });
  dialog
    .querySelectorAll("button")
    .forEach((button) =>
      button.addEventListener("click", () => dialog.close()),
    );
  dialog.addEventListener("close", () => {
    if (mode === "practice") {
      previewGeneration++;
      preview?.destroy(true);
      preview = undefined;
    }
  });
}
