import { GAME_CONFIG as C } from "@bubble/shared";

export const START_MESSAGE_MS = 1000;

/** Elapsed real time since the countdown began; independent of rendering FPS. */
export function startCue(elapsedMs: number): string | null {
  if (elapsedMs < C.countdownMs)
    return String(Math.ceil((C.countdownMs - Math.max(0, elapsedMs)) / 1000));
  return elapsedMs < C.countdownMs + START_MESSAGE_MS ? "Game Start!" : null;
}

export function createStartOverlay(parent: HTMLElement) {
  const overlay = document.createElement("div");
  overlay.className = "game-start-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-label", "게임 시작 안내");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-atomic", "true");
  overlay.hidden = true;
  parent.append(overlay);
  let current: string | null = null;
  return {
    show(text: string | null) {
      if (text === current) return;
      current = text;
      overlay.hidden = text === null;
      overlay.dataset.cue = text ?? "";
      const label = document.createElement("span");
      label.textContent = text;
      overlay.replaceChildren(label);
    },
    destroy() {
      overlay.remove();
    },
  };
}
