import { io, type Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@bubble/shared";
import { effectiveStats, type PracticeState } from "@bubble/shared";
import type { PracticeController } from "./practice";
import { setupOnline } from "./online";
import { portraitSvg, itemSvg } from "./art";
import { arcadeAudio } from "./audio";
import "./style.css";

function soundControls(id: string) {
  return `<div class="sound-controls" id="${id}" role="group" aria-label="소리 설정"><button type="button" data-sound-toggle aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l6-5v16l-6-5H4Z" fill="currentColor"/><path d="M17 8q5 4 0 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>SOUND OFF</span></button><label for="${id}-volume">음량</label><input type="range" id="${id}-volume" data-sound-volume aria-label="전체 음량" min="0" max="100" step="1" value="35"/><output data-sound-level>35%</output><small data-sound-status>소리 없이 플레이</small></div>`;
}
const extraStats = `<div class="competition-stats"><dl><dt>처치 점수</dt><dd data-stat="score"></dd><dt>콤보</dt><dd data-stat="combo"></dd><dt>몬스터</dt><dd data-stat="monsters"></dd></dl><div class="inventory"><span class="item-slot" title="바늘 · 갇힘 해제">${itemSvg("needle")}<small>바늘</small><b data-stat="needle"></b></span><span class="item-slot" title="보호막 · 잠시 무적">${itemSvg("shield")}<small>보호막</small><b data-stat="shield"></b></span><span class="item-slot" title="파워 새싹 · 일시 강화">${itemSvg("power")}<small>파워</small><b data-stat="power"></b></span></div><p data-stat="buffs"></p></div>`;
const localHelp =
  "P1 빨강 WASD 이동 · Space 물풍선 / P2 초록 방향키 이동 · Enter 물풍선. 2.5초 뒤 팡! 물줄기에 닿으면 갇힌 뒤 재생성됩니다.";
const localSpecial =
  "P1 바늘 Q · 보호막 E · 파워 R / P2 바늘 J · 보호막 K · 파워 L. 초록 꼬물이는 안전해요. 보라 까칠이와 닿으면 탈락! 8연속 처치하면 황금 등장.";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="shell">
    <header class="topbar"><a class="brand" href="/" aria-label="버블 크리터 홈"><span class="brand-icon">b.</span><span>BUBBLE CRITTER<small>작은 친구들, 커다란 한 판.</small></span></a><span class="build-tag">DEVELOPMENT <b>06 / 08</b></span></header>
    <main>
      <div class="eyebrow"><span></span> THE LITTLE ARCADE CLUB</div>
      <section class="intro"><div><h1>작은 물방울로,<br />시작하는 큰 모험<span>.</span></h1><p>톡, 놓고 · 쏙, 피하고 · 팡, 터뜨려요.<br />둘이 함께할 새로운 아케이드, 버블 크리터.</p></div><div class="intro-note"><span>✳</span><p>A LITTLE SPLASH.<br />A LOT OF FUN.</p></div></section>
      <section class="game-layout" aria-label="게임 시작">
        <div class="arena-card"><div class="arena-top"><span><i></i> CLOVER GARDEN</span><span>맵 미리보기 <b>01</b></span></div><div class="arena-wrap"><div id="arena" role="img" aria-label="빨강과 초록 진영, 캐릭터와 물풍선이 있는 대칭형 정원 맵"></div><div class="preview-label">PHASER 4 · LIVE PREVIEW</div></div><div class="arena-bottom"><span><i class="red-dot"></i> RED TEAM</span><span>작은 정원에서 만나요</span><span><i class="green-dot"></i> GREEN TEAM</span></div></div>
        <aside class="menu-card"><span class="section-number">LET’S GET STARTED</span><h2>어떻게 시작할까요?</h2><p class="menu-caption">첫 번째 정원을 둘러보세요.</p>
          <button id="competition" class="mode primary"><span class="mode-icon">❋</span><span><strong>꼬물이 대전</strong><small>몬스터를 잡아 상대 정원으로! · 로컬 2인</small></span><span class="arrow">↗</span></button>
          <label class="duration-label">경기 시간 <select id="round-duration"><option value="180000">기본 180초</option><option value="30000">짧게 30초</option></select></label>
          <button id="practice" class="mode secondary"><span class="mode-icon">✳</span><span><strong>연습 모드</strong><small>몬스터 없이 물풍선 연습하기</small></span><span class="arrow">↗</span></button>
          <button id="online" class="mode secondary"><span class="mode-icon">◎</span><span><strong>온라인 대전</strong><small>방 코드로 만나 각자의 브라우저에서 플레이</small></span><span class="arrow">↗</span></button>
          ${soundControls("menu-audio")}
          <div class="stage-note"><span>톡, 쏙, 팡! 작은 정원의 소리</span><p>소리를 켜면 정원만의 멜로디가 흘러요.<br />8자리 방 코드로 친구도 초대해 보세요.</p></div>
          <div class="connection"><span id="connection-dot"></span><span id="connection" role="status">서버 연결 중…</span><span>DEV 0.6</span></div>
        </aside>
      </section>
      <section class="bottom-grid"><div><span class="detail-icon">⌘</span><div><h3>간단한 조작, 즐거운 대결</h3><p>이동 <kbd>W A S D</kbd> 물풍선 <kbd>SPACE</kbd><small>로컬 P2는 방향키 이동 · Enter 물풍선</small></p></div></div><div><span class="detail-icon">❋</span><div><h3>우리만의 작은 친구들</h3><p>직접 만든 캐릭터와 밝은 정원.<br />새로운 버블 세계를 함께 만들어가요.</p></div></div><div><span class="detail-icon">↗</span><div><h3>두 사람을 위한 아케이드</h3><p>방 코드로 만나는 1:1 대전.<br />온라인은 두 사람이 READY하면 시작해요.</p></div></div></section>
    </main><footer><span>BUBBLE CRITTER DUEL © 2026</span><span>독자 리소스로 만드는 비공식 아케이드 프로젝트</span></footer>
  </div>
  <dialog id="practice-dialog" aria-labelledby="practice-title"><div class="dialog-header"><div><span class="section-number">PRACTICE · LOCAL DUO</span><h2 id="practice-title">둘이 노는 클로버 정원</h2></div><div class="game-header-tools">${soundControls("game-audio")}<button class="close" aria-label="연습 화면 닫기">×</button></div></div>
    <p class="practice-help"><b>P1 빨강</b> WASD 이동 · Space 물풍선　 /　 <b>P2 초록</b> 방향키 이동 · Enter 물풍선<br />2.5초 뒤 팡! 상자를 부수고 아이템을 모으세요. 물줄기에 닿으면 갇힌 뒤 재생성됩니다.</p>
    <p id="network-message" role="status" hidden></p>
    <div id="round-bar" hidden><span>RED <b id="red-score">0</b></span><div><time id="round-clock">03:00</time><small id="round-warning" role="status"></small></div><span><b id="green-score">0</b> GREEN</span></div>
    <p id="special-controls" hidden>P1 바늘 Q · 보호막 E · 파워 R　 /　 P2 바늘 J · 보호막 K · 파워 L<br />초록 꼬물이는 안전해요. 보라 까칠이와 닿으면 탈락! 8연속 처치하면 황금 등장.</p>
    <div class="practice-layout"><div class="competition-stage"><div id="practice-arena" aria-label="로컬 2인 게임 경기장"></div><section id="result-panel" aria-label="경기 결과" hidden><span>ROUND COMPLETE</span><div class="result-friends"><span class="portrait result-red">${portraitSvg("red")}</span><svg class="result-trophy" viewBox="0 0 64 64" aria-hidden="true"><path d="M20 13H9v11q0 14 17 14m18-25h11v11q0 14-17 14" fill="none" stroke="#d6aa4f" stroke-width="4"/><path d="M17 7h30v19q0 15-15 17-15-2-15-17Z" fill="#ffdb79" stroke="#af8d4c" stroke-width="2"/><path d="M32 43v11M22 57h20" fill="none" stroke="#af8d4c" stroke-width="5" stroke-linecap="round"/><path d="m32 14 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#fff8d9"/></svg><span class="portrait result-green">${portraitSvg("green")}</span></div><h3 id="result-title"></h3><p id="result-score"></p><p>아래 재대결 버튼으로 다시 시작해요.</p></section></div><aside class="practice-hud" aria-label="플레이어 능력치">
      <div class="player-panel red-panel" data-player="p1"><div class="player-profile"><span class="portrait">${portraitSvg("red")}</span><div><h3>P1 · RED</h3><span class="profile-name">루비</span><p class="player-status" role="status"></p></div></div><dl><dt>물풍선</dt><dd data-stat="balloon"></dd><dt>물줄기</dt><dd data-stat="range"></dd><dt>이동속도</dt><dd data-stat="speed"></dd><dt>재생성</dt><dd data-stat="deaths"></dd></dl>${extraStats}</div>
      <div class="player-panel green-panel" data-player="p2"><div class="player-profile"><span class="portrait">${portraitSvg("green")}</span><div><h3>P2 · GREEN</h3><span class="profile-name">모모</span><p class="player-status" role="status"></p></div></div><dl><dt>물풍선</dt><dd data-stat="balloon"></dd><dt>물줄기</dt><dd data-stat="range"></dd><dt>이동속도</dt><dd data-stat="speed"></dd><dt>재생성</dt><dd data-stat="deaths"></dd></dl>${extraStats}</div>
      <div class="item-guide"><span>${itemSvg("balloon")}물풍선</span><span>${itemSvg("range")}물줄기</span><span>${itemSvg("speed")}이동속도</span></div><p class="practice-note" id="mode-note">연습은 시간제한 없이 계속됩니다.</p>
    </aside></div><div class="practice-actions"><button id="restart-practice">처음부터 다시</button><button class="back">메뉴로 돌아가기</button></div></dialog>
  <dialog id="online-dialog" aria-labelledby="online-title"><div class="dialog-header"><div><span class="section-number">ONLINE · CRITTER DUEL</span><h2 id="online-title">친구와 정원에서 만나요</h2></div><button class="close" aria-label="온라인 화면 닫기">×</button></div>
    <div id="online-setup"><label>닉네임<input id="nickname" maxlength="16" autocomplete="nickname" placeholder="1~16자 닉네임" /></label><label>온라인 경기 시간<select id="online-duration"><option value="180000">180초</option><option value="30000">30초</option></select></label><button id="online-create">방 만들기</button><div class="join-row"><label>방 코드<input id="join-code" maxlength="8" placeholder="8자리 코드" autocapitalize="characters" /></label><button id="online-join">방 참가하기</button></div></div>
    <div id="online-lobby" hidden><p id="online-team"></p><output id="room-code" aria-label="현재 방 코드"></output><div class="lobby-actions"><button id="copy-code">코드 복사</button><button id="copy-link">초대 링크 복사</button></div><ul id="room-players"></ul><p id="lobby-status" role="status"></p><div class="lobby-actions"><button id="online-ready">READY</button><button id="online-leave">방 나가기</button></div></div>
    <p id="online-message" role="status"></p><div class="online-status" id="online-status" role="status">연결 상태 확인 중…</div><button class="back">메뉴로 돌아가기</button></dialog>
`;
arcadeAudio.bind();

const socket: Socket<ServerEvents, ClientEvents> = io({ timeout: 5000 });
function connection(ready: boolean) {
  document.querySelector("#connection")!.textContent = ready
    ? "개발 서버 연결됨"
    : "서버 연결 끊김 · 재연결 중";
  document
    .querySelector("#connection-dot")!
    .classList.toggle("connected", ready);
  document.querySelector("#online-status")!.textContent = ready
    ? "● 서버 연결됨 · 온라인 2인 대전"
    : "○ 서버에 연결할 수 없습니다. 개발 서버 실행 상태를 확인하세요.";
}
socket.on("hello", (message) => connection(message.protocol === 1));
socket.on("disconnect", () => connection(false));
socket.on("connect_error", () => connection(false));

let preview: PracticeController | undefined;
let previewGeneration = 0;
let onlineGame = false;
let onlinePlayerId: string | null = null;
function updatePracticeHud(state: PracticeState) {
  document.querySelector<HTMLElement>("#practice-arena")!.dataset.tick = String(
    state.tick,
  );
  const r = state.round;
  const result = document.querySelector<HTMLElement>("#result-panel")!;
  result.hidden = r?.phase !== "FINISHED";
  result.dataset.winner = r?.winner ?? "none";
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
  if (onlineGame) {
    const view = online.current();
    const button =
      document.querySelector<HTMLButtonElement>("#restart-practice")!;
    button.hidden = !view || view.phase === "PLAYING";
    const self = view?.players.find((p) => p.id === onlinePlayerId);
    button.disabled =
      !online.connected() ||
      !!self?.ready ||
      view?.phase === "COUNTDOWN" ||
      view?.players.length !== 2 ||
      !!view?.players.some((p) => !p.connected);
    button.textContent = self?.ready ? "재대결 준비 중" : "재대결 준비";
  }
  for (const player of state.players) {
    const panel = document.querySelector<HTMLElement>(
      `[data-player="${player.id}"]`,
    )!;
    panel.dataset.x = player.position.x.toFixed(3);
    panel.dataset.y = player.position.y.toFixed(3);
    panel.dataset.status = player.status;
    panel.dataset.mood =
      r?.phase === "FINISHED"
        ? r.winner === player.team
          ? "win"
          : r.winner === "draw"
            ? "idle"
            : "lose"
        : player.status;
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
      if (node.textContent !== value) {
        node.textContent = value;
        if (
          name === "combo" &&
          player.combo >= 2 &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          node.animate(
            [
              { transform: "scale(1.25)", color: "#e19030" },
              { transform: "scale(1)", color: "#a46c39" },
            ],
            { duration: 260 },
          );
      }
      if (["needle", "shield", "power"].includes(name))
        (node.parentElement as HTMLElement).dataset.amount = value;
    }
  }
}
document
  .querySelector("#restart-practice")!
  .addEventListener("click", () => preview?.reset());
const sceneModule = import("./preview");
let menuPreview:
  | {
      loop: { sleep(): void; wake(): void };
      events: { once: (event: string, callback: () => void) => unknown };
    }
  | undefined;
function sleepMenu() {
  const menu = menuPreview;
  if (!menu) return;
  if (document.querySelector("#arena")?.getAttribute("data-ready") === "true")
    menu.loop.sleep();
  else
    menu.events.once("postrender", () => {
      if (document.querySelector<HTMLDialogElement>("#practice-dialog")!.open)
        menu.loop.sleep();
    });
}
sceneModule
  .then(({ mountPreview }) => {
    menuPreview = mountPreview(document.querySelector("#arena")!);
    if (document.querySelector<HTMLDialogElement>("#practice-dialog")!.open)
      sleepMenu();
  })
  .catch(() => {
    document.querySelector("#arena")!.textContent =
      "화면을 불러오지 못했습니다. 새로고침해 주세요.";
  });
const online = setupOnline(socket, {
  openGame: async (timeline) => {
    const dialog =
      document.querySelector<HTMLDialogElement>("#practice-dialog")!;
    onlineGame = true;
    onlinePlayerId = timeline.playerId;
    dialog.classList.add("competition-mode");
    document.querySelector("#practice-title")!.textContent =
      `온라인 대전 · ${timeline.playerId === "p1" ? "빨강 팀" : "초록 팀"}`;
    document.querySelector("#practice-dialog .section-number")!.textContent =
      "ONLINE · CRITTER DUEL";
    document.querySelector(".practice-help")!.textContent =
      "내 캐릭터 이동 WASD / 방향키 · 물풍선 Space / Enter · 바늘 Q/J · 보호막 E/K · 파워 R/L";
    document.querySelector("#special-controls")!.textContent =
      "바늘 Q/J · 보호막 E/K · 파워 R/L. 각자 자신의 캐릭터를 조작해요. 초록 꼬물이는 안전하고 보라 까칠이는 위험해요!";
    document.querySelector("#mode-note")!.textContent =
      "각자 자신의 캐릭터만 조작합니다. 서버에서 경기 상태를 판정합니다.";
    for (const element of document.querySelectorAll<HTMLElement>(
      "#round-bar,#special-controls,.competition-stats,#network-message",
    ))
      element.hidden = false;
    if (!dialog.open) dialog.showModal();
    sleepMenu();
    const generation = ++previewGeneration;
    try {
      const { mountPractice } = await import("./practice");
      if (
        !dialog.open ||
        generation !== previewGeneration ||
        !timeline.view?.game
      )
        return;
      preview?.destroy(true);
      preview = mountPractice(
        document.querySelector("#practice-arena")!,
        updatePracticeHud,
        {
          remote: {
            initial: timeline.view.game,
            frame: (inputs, delta) =>
              timeline.frame(inputs, delta, online.connected()),
            restart: () => void online.ready(),
          },
        },
      );
    } catch {
      document.querySelector("#network-message")!.textContent =
        "게임 화면을 열지 못했습니다. 새로고침하면 자리 복구를 시도합니다.";
    }
  },
  closeGame: () => {
    onlineGame = false;
    document.querySelector<HTMLDialogElement>("#practice-dialog")!.close();
  },
  status: (message, view) => {
    if (onlineGame)
      document.querySelector("#network-message")!.textContent = message;
    if (onlineGame && view)
      for (const member of view.players)
        document.querySelector(
          `[data-player="${member.id}"] .profile-name`,
        )!.textContent = member.nickname;
  },
});
for (const mode of ["practice", "competition"]) {
  const dialog = document.querySelector<HTMLDialogElement>(
    `#${mode === "competition" ? "practice" : mode}-dialog`,
  )!;
  document.querySelector(`#${mode}`)!.addEventListener("click", async () => {
    dialog.showModal();
    {
      onlineGame = false;
      document.querySelector<HTMLElement>("#network-message")!.hidden = true;
      const restart =
        document.querySelector<HTMLButtonElement>("#restart-practice")!;
      restart.hidden = false;
      restart.disabled = false;
      document.querySelector(".practice-help")!.textContent = localHelp;
      document.querySelector("#special-controls")!.textContent = localSpecial;
      document.querySelector('[data-player="p1"] .profile-name')!.textContent =
        "루비";
      document.querySelector('[data-player="p2"] .profile-name')!.textContent =
        "모모";
      sleepMenu();
      const competition = mode === "competition";
      document.querySelector("#practice-dialog .section-number")!.textContent =
        competition ? "CRITTER DUEL · LOCAL 1:1" : "PRACTICE · CLOVER GARDEN";
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
      const leavingOnline = onlineGame;
      onlineGame = false;
      previewGeneration++;
      preview?.destroy(true);
      preview = undefined;
      menuPreview?.loop.wake();
      if (leavingOnline) void online.leave();
    }
  });
}
