import { io, type Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@bubble/shared";
import { effectiveStats, type PracticeState } from "@bubble/shared";
import type { PracticeController } from "./practice";
import "./style.css";

const extraStats = `<div class="competition-stats"><dl><dt>처치 점수</dt><dd data-stat="score"></dd><dt>콤보</dt><dd data-stat="combo"></dd><dt>몬스터</dt><dd data-stat="monsters"></dd></dl><div class="inventory"><span>바늘 <b data-stat="needle"></b></span><span>보호막 <b data-stat="shield"></b></span><span>파워 <b data-stat="power"></b></span></div><p data-stat="buffs"></p></div>`;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="shell">
    <header class="topbar"><a class="brand" href="/" aria-label="버블 크리터 홈"><span class="brand-icon">b.</span><span>BUBBLE CRITTER<small>작은 친구들, 커다란 한 판.</small></span></a><span class="build-tag">DEVELOPMENT <b>03 / 08</b></span></header>
    <main>
      <div class="eyebrow"><span></span> THE LITTLE ARCADE CLUB</div>
      <section class="intro"><div><h1>작은 물방울로,<br />시작하는 큰 모험<span>.</span></h1><p>톡, 놓고 · 쏙, 피하고 · 팡, 터뜨려요.<br />둘이 함께할 새로운 아케이드, 버블 크리터.</p></div><div class="intro-note"><span>✳</span><p>A LITTLE SPLASH.<br />A LOT OF FUN.</p></div></section>
      <section class="game-layout" aria-label="게임 시작">
        <div class="arena-card"><div class="arena-top"><span><i></i> CLOVER GARDEN</span><span>맵 미리보기 <b>01</b></span></div><div class="arena-wrap"><div id="arena" role="img" aria-label="빨강과 초록 진영, 캐릭터와 물풍선이 있는 대칭형 정원 맵"></div><div class="preview-label">PHASER 4 · LIVE PREVIEW</div></div><div class="arena-bottom"><span><i class="red-dot"></i> RED TEAM</span><span>작은 정원에서 만나요</span><span><i class="green-dot"></i> GREEN TEAM</span></div></div>
        <aside class="menu-card"><span class="section-number">LET’S GET STARTED</span><h2>어떻게 시작할까요?</h2><p class="menu-caption">첫 번째 정원을 둘러보세요.</p>
          <button id="competition" class="mode primary"><span class="mode-icon">❋</span><span><strong>꼬물이 대전</strong><small>몬스터를 잡아 상대 정원으로! · 로컬 2인</small></span><span class="arrow">↗</span></button>
          <label class="duration-label">경기 시간 <select id="round-duration"><option value="180000">기본 180초</option><option value="30000">짧게 30초</option></select></label>
          <button id="practice" class="mode secondary"><span class="mode-icon">✳</span><span><strong>연습 모드</strong><small>몬스터 없이 물풍선 연습하기</small></span><span class="arrow">↗</span></button>
          <button id="online" class="mode secondary"><span class="mode-icon">◎</span><span><strong>온라인 대전</strong><small>개발 안내 · 서버 연결 확인</small></span><span class="arrow">↗</span></button>
          <div class="stage-note"><span>세 번째 단계 · 작은 친구들의 경쟁</span><p>처치한 몬스터가 상대 진영에 늘어나요.<br />콤보와 특수 아이템으로 점수를 겨뤄요.</p></div>
          <div class="connection"><span id="connection-dot"></span><span id="connection" role="status">서버 연결 중…</span><span>DEV 0.3</span></div>
        </aside>
      </section>
      <section class="bottom-grid"><div><span class="detail-icon">⌘</span><div><h3>간단한 조작, 즐거운 대결</h3><p>이동 <kbd>W A S D</kbd> 물풍선 <kbd>SPACE</kbd><small>P2는 방향키 이동 · Enter 물풍선</small></p></div></div><div><span class="detail-icon">❋</span><div><h3>우리만의 작은 친구들</h3><p>직접 만든 캐릭터와 밝은 정원.<br />새로운 버블 세계를 함께 만들어가요.</p></div></div><div><span class="detail-icon">↗</span><div><h3>두 사람을 위한 아케이드</h3><p>방 코드로 만나는 1:1 대전.<br />온라인 플레이는 4단계에서 준비됩니다.</p></div></div></section>
    </main><footer><span>BUBBLE CRITTER DUEL © 2026</span><span>독자 리소스로 만드는 비공식 아케이드 프로젝트</span></footer>
  </div>
  <dialog id="practice-dialog" aria-labelledby="practice-title"><div class="dialog-header"><div><span class="section-number">PRACTICE · LOCAL DUO</span><h2 id="practice-title">둘이 노는 클로버 정원</h2></div><button class="close" aria-label="연습 화면 닫기">×</button></div>
    <p class="practice-help"><b>P1 빨강</b> WASD 이동 · Space 물풍선　 /　 <b>P2 초록</b> 방향키 이동 · Enter 물풍선<br />2.5초 뒤 팡! 상자를 부수고 아이템을 모으세요. 물줄기에 닿으면 갇힌 뒤 재생성됩니다.</p>
    <div id="round-bar" hidden><span>RED <b id="red-score">0</b></span><div><time id="round-clock">03:00</time><small id="round-warning" role="status"></small></div><span><b id="green-score">0</b> GREEN</span></div>
    <p id="special-controls" hidden>P1 바늘 Q · 보호막 E · 파워 R　 /　 P2 바늘 J · 보호막 K · 파워 L<br />초록 꼬물이는 안전해요. 보라 까칠이와 닿으면 탈락! 8연속 처치하면 황금 등장.</p>
    <div class="practice-layout"><div class="competition-stage"><div id="practice-arena" aria-label="로컬 2인 게임 경기장"></div><section id="result-panel" aria-label="경기 결과" hidden><span>ROUND COMPLETE</span><h3 id="result-title"></h3><p id="result-score"></p><p>아래 재대결 버튼으로 다시 시작해요.</p></section></div><aside class="practice-hud" aria-label="플레이어 능력치">
      <div class="player-panel red-panel" data-player="p1"><h3>P1 · RED</h3><p class="player-status" role="status"></p><dl><dt>물풍선</dt><dd data-stat="balloon"></dd><dt>물줄기</dt><dd data-stat="range"></dd><dt>이동속도</dt><dd data-stat="speed"></dd><dt>재생성</dt><dd data-stat="deaths"></dd></dl>${extraStats}</div>
      <div class="player-panel green-panel" data-player="p2"><h3>P2 · GREEN</h3><p class="player-status" role="status"></p><dl><dt>물풍선</dt><dd data-stat="balloon"></dd><dt>물줄기</dt><dd data-stat="range"></dd><dt>이동속도</dt><dd data-stat="speed"></dd><dt>재생성</dt><dd data-stat="deaths"></dd></dl>${extraStats}</div>
      <p class="item-guide">아이템 안내<br /><span>●</span> 물풍선 개수 증가<br /><span>＋</span> 물줄기 거리 증가<br /><span>▶</span> 이동속도 증가</p><p class="practice-note" id="mode-note">연습은 시간제한 없이 계속됩니다.</p>
    </aside></div><div class="practice-actions"><button id="restart-practice">처음부터 다시</button><button class="back">메뉴로 돌아가기</button></div></dialog>
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

let preview: PracticeController | undefined;
let previewGeneration = 0;
function updatePracticeHud(state: PracticeState) {
  document.querySelector<HTMLElement>("#practice-arena")!.dataset.tick = String(
    state.tick,
  );
  const r = state.round;
  const result = document.querySelector<HTMLElement>("#result-panel")!;
  result.hidden = r?.phase !== "FINISHED";
  if (r) {
    const seconds = Math.max(0, Math.ceil((r.durationMs - state.time) / 1000));
    document.querySelector("#round-clock")!.textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    document.querySelector<HTMLElement>("#round-bar")!.dataset.warning =
      r.warning;
    document.querySelector("#round-warning")!.textContent =
      r.phase === "FINISHED"
        ? "경기 종료"
        : r.warning === "final"
          ? "마지막 15초!"
          : r.warning === "rush"
            ? "마지막 30초 · 몬스터 급증!"
            : "몬스터를 잡아 상대 정원으로!";
    document.querySelector("#red-score")!.textContent = String(
      state.players[0].score,
    );
    document.querySelector("#green-score")!.textContent = String(
      state.players[1].score,
    );
    document.querySelector("#restart-practice")!.textContent =
      r.phase === "FINISHED" ? "재대결" : "경기 다시 시작";
    if (r.phase === "FINISHED") {
      document.querySelector("#result-title")!.textContent =
        r.winner === "draw"
          ? "무승부!"
          : r.winner === "red"
            ? "빨강 팀 승리!"
            : "초록 팀 승리!";
      document.querySelector("#result-score")!.textContent =
        `RED ${state.players[0].score} : ${state.players[1].score} GREEN`;
    }
  }
  for (const player of state.players) {
    const panel = document.querySelector<HTMLElement>(
      `[data-player="${player.id}"]`,
    )!;
    panel.dataset.x = player.position.x.toFixed(3);
    panel.dataset.y = player.position.y.toFixed(3);
    panel.dataset.status = player.status;
    const status =
      player.status === "trapped"
        ? "물방울에 갇힘!"
        : player.status === "respawning"
          ? "다시 오는 중…"
          : player.invulnerableUntil > state.time
            ? "잠시 무적!"
            : "준비 완료";
    const fields: Record<string, string> = {
      balloon: `${state.balloons.filter((b) => b.owner === player.id).length} / ${effectiveStats(state, player).capacity}`,
      range: `${effectiveStats(state, player).range}칸`,
      speed: `${effectiveStats(state, player).speed.toFixed(1)}칸/초`,
      deaths: `${player.deaths}회`,
      score: String(player.score),
      combo: player.combo >= 2 ? `${player.combo} COMBO!` : "—",
      monsters: `${r?.monsters.filter((m) => m.team === player.team).length ?? 0} (대기 ${r?.pending.filter((p) => p.team === player.team).reduce((n, p) => n + p.count, 0) ?? 0})`,
      needle: String(player.inventory.needle),
      shield: String(player.inventory.shield),
      power: String(player.inventory.power),
      buffs: [
        player.shieldUntil > state.time
          ? `보호막 ${Math.ceil((player.shieldUntil - state.time) / 1000)}초`
          : "",
        player.powerUntil > state.time
          ? `파워 ${Math.ceil((player.powerUntil - state.time) / 1000)}초`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
    const statusNode = panel.querySelector(".player-status")!;
    if (statusNode.textContent !== status) statusNode.textContent = status;
    for (const [name, value] of Object.entries(fields)) {
      const node = panel.querySelector(`[data-stat="${name}"]`)!;
      if (node.textContent !== value) node.textContent = value;
    }
  }
}
document
  .querySelector("#restart-practice")!
  .addEventListener("click", () => preview?.reset());
const sceneModule = import("./scene");
let menuPreview: { loop: { sleep(): void; wake(): void } } | undefined;
sceneModule
  .then(({ mountPreview }) => {
    menuPreview = mountPreview(document.querySelector("#arena")!);
    if (document.querySelector<HTMLDialogElement>("#practice-dialog")!.open)
      menuPreview.loop.sleep();
  })
  .catch(() => {
    document.querySelector("#arena")!.textContent =
      "화면을 불러오지 못했습니다. 새로고침해 주세요.";
  });
for (const mode of ["practice", "competition", "online"]) {
  const dialog = document.querySelector<HTMLDialogElement>(
    `#${mode === "competition" ? "practice" : mode}-dialog`,
  )!;
  document.querySelector(`#${mode}`)!.addEventListener("click", async () => {
    dialog.showModal();
    if (mode !== "online") {
      menuPreview?.loop.sleep();
      const competition = mode === "competition";
      dialog.classList.toggle("competition-mode", competition);
      document.querySelector("#practice-title")!.textContent = competition
        ? "꼬물이 정원 대전"
        : "둘이 노는 클로버 정원";
      document.querySelector("#restart-practice")!.textContent = competition
        ? "경기 다시 시작"
        : "처음부터 다시";
      document.querySelector("#mode-note")!.textContent = competition
        ? "처치하면 상대 진영에 몬스터가 늘어나요. 시간이 끝나면 점수가 높은 팀이 승리!"
        : "연습은 시간제한 없이 계속됩니다.";
      for (const element of document.querySelectorAll<HTMLElement>(
        "#round-bar,#special-controls,.competition-stats",
      ))
        element.hidden = !competition;
      const generation = ++previewGeneration;
      try {
        const { mountPractice } = await import("./practice");
        if (dialog.open && generation === previewGeneration)
          preview = mountPractice(
            document.querySelector("#practice-arena")!,
            updatePracticeHud,
            {
              competition,
              durationMs: Number(
                document.querySelector<HTMLSelectElement>("#round-duration")!
                  .value,
              ),
            },
          );
      } catch {
        document.querySelector("#practice-arena")!.textContent =
          "렌더러를 불러오지 못했습니다.";
      }
    }
  });
  if (mode === "competition") continue; // practice and competition share a single dialog lifecycle.
  dialog
    .querySelectorAll(".close, .back")
    .forEach((button) =>
      button.addEventListener("click", () => dialog.close()),
    );
  dialog.addEventListener("close", () => {
    if (mode === "practice") {
      previewGeneration++;
      preview?.destroy(true);
      preview = undefined;
      menuPreview?.loop.wake();
    }
  });
}
