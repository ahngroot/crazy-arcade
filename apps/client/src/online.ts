import type { Socket } from "socket.io-client";
import type {
  ClientEvents,
  ServerEvents,
  RoomView,
  AdmissionResult,
} from "@bubble/shared";
import { OnlineTimeline, hasActionTransition } from "./netcode";

export function setupOnline(
  socket: Socket<ServerEvents, ClientEvents>,
  hooks: {
    openGame: (timeline: OnlineTimeline) => void;
    closeGame: () => void;
    status: (message: string, view: RoomView | null) => void;
  },
) {
  const dialog = document.querySelector<HTMLDialogElement>("#online-dialog")!;
  const message = document.querySelector<HTMLElement>("#online-message")!;
  let view: RoomView | null = null,
    timeline: OnlineTimeline | null = null,
    token: string | null = null,
    playerId: string | null = null,
    inGame = false,
    resuming = false,
    busy = false;
  const storageKey = "bubble-room-session-v1";
  try {
    const session = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (
      session &&
      typeof session.token === "string" &&
      /^[a-f0-9]{64}$/.test(session.token)
    )
      token = session.token;
  } catch {
    /* unavailable storage: current session still works */
  }
  const show = () => {
    if (!dialog.open) dialog.showModal();
  };
  const stateMessage = () =>
    !socket.connected
      ? "서버 연결 끊김 · 재연결 중입니다."
      : !view
        ? "닉네임을 입력하고 방을 만들거나 코드로 입장하세요."
        : view.paused
          ? "상대 연결 끊김 · 최대 30초간 기다립니다. 경기는 잠시 멈췄습니다."
          : view.phase === "COUNTDOWN"
            ? `${Math.max(0, Math.ceil(((view.countdownEndsAt ?? view.serverTime) - view.serverTime) / 1000))}초 뒤 시작!`
            : view.phase === "PLAYING"
              ? "경기 진행 중"
              : view.phase === "FINISHED"
                ? "경기 종료 · 두 사람이 재대결 준비를 하면 다시 시작합니다."
                : view.players.length < 2
                  ? "상대 입장을 기다립니다."
                  : view.players.some((p) => !p.connected)
                    ? "상대가 재접속 중입니다."
                    : "두 사람이 READY를 누르면 시작합니다.";
  function render() {
    for (const id of ["online-create", "online-join"])
      document.querySelector<HTMLButtonElement>(`#${id}`)!.disabled =
        busy || !socket.connected;
    document.querySelector<HTMLElement>("#online-setup")!.hidden = !!view;
    document.querySelector<HTMLElement>("#online-lobby")!.hidden = !view;
    document.querySelector("#lobby-status")!.textContent = stateMessage();
    hooks.status(stateMessage(), view);
    if (!view) return;
    document.querySelector("#room-code")!.textContent = view.code;
    document.querySelector("#online-team")!.textContent =
      playerId === "p1" ? "내 팀 · RED" : "내 팀 · GREEN";
    const list = document.querySelector("#room-players")!;
    list.replaceChildren();
    for (const member of view.players) {
      const li = document.createElement("li");
      li.textContent = `${member.team === "red" ? "빨강" : "초록"} · ${member.nickname}${member.id === playerId ? " (나)" : ""} · ${!member.connected ? "재접속 대기" : member.ready ? "READY" : "준비 전"}`;
      list.append(li);
    }
    const ready = document.querySelector<HTMLButtonElement>("#online-ready")!;
    ready.disabled =
      busy ||
      !socket.connected ||
      view.players.length !== 2 ||
      view.players.some((p) => !p.connected) ||
      ["PLAYING", "COUNTDOWN"].includes(view.phase);
    ready.textContent = view.players.find((p) => p.id === playerId)?.ready
      ? "준비 취소"
      : "READY";
  }
  function receive(next: RoomView) {
    if (!timeline || !playerId || next.code !== view?.code) return;
    view = next;
    timeline.receive(next);
    render();
    if (next.game && !inGame) {
      inGame = true;
      dialog.close();
      hooks.openGame(timeline);
    } else if (!next.game && inGame) {
      inGame = false;
      hooks.closeGame();
      show();
    }
  }
  async function admission(
    event: "createRoom" | "joinRoom" | "resumeRoom",
    request: unknown,
  ) {
    if (busy || !socket.connected) return;
    busy = true;
    message.textContent = "연결 중…";
    render();
    try {
      const result: AdmissionResult = await socket
        .timeout(5000)
        .emitWithAck(event, request);
      if (!result.ok) {
        message.textContent = result.error;
        if (event === "resumeRoom") {
          token = null;
          try {
            sessionStorage.removeItem(storageKey);
          } catch {}
          if (inGame) {
            inGame = false;
            hooks.closeGame();
          }
          view = null;
          timeline = null;
          show();
        }
        return;
      }
      token = result.token;
      playerId = result.playerId;
      view = result.room;
      let saved = true;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ token }));
      } catch {
        saved = false;
      }
      const reopen = inGame;
      let previousActions = {
        balloon: false,
        useItem: false,
      };
      timeline = new OnlineTimeline(playerId, (packet) => {
        if (!socket.connected) return;
        const edge = hasActionTransition(packet, {
          x: 0,
          y: 0,
          ...previousActions,
        });
        previousActions = {
          balloon: packet.balloon,
          useItem: !!packet.useItem,
        };
        if (edge) socket.emit("input", packet);
        else socket.volatile.emit("input", packet);
      });
      message.textContent = saved
        ? ""
        : "이 브라우저에서는 새로고침 후 자리를 복구할 수 없습니다.";
      receive(result.room);
      if (reopen && result.room.game) hooks.openGame(timeline);
      if (!inGame) show();
    } catch {
      message.textContent =
        "서버 응답이 없습니다. 연결 상태를 확인한 후 다시 시도하세요.";
    } finally {
      busy = false;
      render();
    }
  }
  async function ready() {
    if (!view || !socket.connected) return;
    const self = view.players.find((p) => p.id === playerId);
    if (!self) return;
    try {
      const result = await socket
        .timeout(5000)
        .emitWithAck("readyRoom", !self.ready);
      if (!result.ok) message.textContent = result.error;
    } catch {
      message.textContent = "준비 요청에 응답이 없습니다.";
    }
  }
  async function leave() {
    // Clear the credential even when the server is unreachable. Its reservation then expires.
    token = null;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
    const wasInGame = inGame;
    inGame = false;
    view = null;
    timeline = null;
    if (wasInGame) hooks.closeGame();
    if (socket.connected)
      try {
        await socket.timeout(3000).emitWithAck("leaveRoom");
      } catch {}
    message.textContent = "방에서 나왔습니다.";
    render();
  }
  document.querySelector("#online")!.addEventListener("click", () => {
    if (inGame && timeline) hooks.openGame(timeline);
    else {
      show();
      render();
    }
  });
  document.querySelector("#online-create")!.addEventListener(
    "click",
    () =>
      void admission("createRoom", {
        nickname: document.querySelector<HTMLInputElement>("#nickname")!.value,
        durationMs: Number(
          document.querySelector<HTMLSelectElement>("#online-duration")!.value,
        ),
      }),
  );
  document.querySelector("#online-join")!.addEventListener(
    "click",
    () =>
      void admission("joinRoom", {
        nickname: document.querySelector<HTMLInputElement>("#nickname")!.value,
        code: document
          .querySelector<HTMLInputElement>("#join-code")!
          .value.trim()
          .toUpperCase(),
      }),
  );
  document
    .querySelector("#online-ready")!
    .addEventListener("click", () => void ready());
  document
    .querySelector("#online-leave")!
    .addEventListener("click", () => void leave());
  for (const button of dialog.querySelectorAll(".close,.back"))
    button.addEventListener("click", () => {
      dialog.close();
      void leave();
    });
  dialog.addEventListener("cancel", () => void leave());
  for (const [id, link] of [
    ["copy-code", false],
    ["copy-link", true],
  ] as const)
    document.querySelector(`#${id}`)!.addEventListener("click", async () => {
      if (!view) return;
      const url = new URL(location.href);
      url.searchParams.set("room", view.code);
      try {
        await navigator.clipboard.writeText(link ? url.href : view.code);
        message.textContent = "복사했습니다.";
      } catch {
        message.textContent = `복사가 제한되어 있습니다. 방 코드를 직접 공유하세요: ${view.code}`;
      }
    });
  const invite = new URL(location.href).searchParams.get("room");
  if (invite && /^[A-HJ-NP-Z2-9]{8}$/i.test(invite)) {
    document.querySelector<HTMLInputElement>("#join-code")!.value =
      invite.toUpperCase();
    show();
  }
  socket.on("room", receive);
  socket.on("disconnect", () => {
    timeline?.resetConnection();
    render();
  });
  socket.on("connect_error", () => render());
  async function reconnect() {
    if (token && !resuming) {
      resuming = true;
      await admission("resumeRoom", { token });
      resuming = false;
    } else render();
  }
  socket.on("connect", () => void reconnect());
  if (socket.connected) void reconnect();
  else render();
  return {
    leave,
    ready,
    connected: () => socket.connected,
    current: () => view,
  };
}
