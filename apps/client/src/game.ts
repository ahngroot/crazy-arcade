import Phaser from "phaser";
import {
  GAME_CONFIG as C,
  createArenaPractice,
  stepPractice,
  type PracticeState,
  type LocalInput,
  type RoomView,
  type Facing,
} from "@bubble/shared";
import { GameRenderer } from "./renderer";
import { arcadeAudio } from "./audio";
import { createStartOverlay, startCue, START_MESSAGE_MS } from "./countdown";
import { selectedCharacter } from "./character-selection";

const GAME_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ControlLeft",
  "ControlRight",
]);
const isControl = (code: string) =>
  code === "ControlLeft" || code === "ControlRight";
const editing = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest("input,select,textarea,button,[contenteditable]");

let nextTurnId = Date.now() * 1000;

/** One keyboard controls one character in solo practice or online play. */
export class GameKeyboard {
  private enabled = false;
  private keys = new Set<string>();
  private balloonPending = false;
  private turn?: Facing;
  private turnId?: number;
  private itemEdges: boolean[] = [];
  private controlHeld() {
    return this.keys.has("ControlLeft") || this.keys.has("ControlRight");
  }
  private itemEdge(pressed: boolean) {
    if (this.itemEdges.length < C.maxPendingInputs)
      this.itemEdges.push(pressed);
  }
  private down = (event: KeyboardEvent) => {
    if (!GAME_KEYS.has(event.code) || editing(event.target)) return;
    event.preventDefault();
    if (!this.enabled || (event.repeat && !this.keys.has(event.code))) return;
    const controlWasHeld = this.controlHeld();
    if (event.code.startsWith("Arrow") && !this.keys.has(event.code)) {
      this.turn = (
        {
          ArrowUp: "up",
          ArrowDown: "down",
          ArrowLeft: "left",
          ArrowRight: "right",
        } as Record<string, Facing>
      )[event.code];
      this.turnId = ++nextTurnId;
    }
    this.keys.add(event.code);
    if (isControl(event.code) && !controlWasHeld && !event.repeat)
      this.itemEdge(true);
    if (event.code === "Space" && !event.repeat) this.balloonPending = true;
  };
  private up = (event: KeyboardEvent) => {
    if (!GAME_KEYS.has(event.code)) return;
    if (!editing(event.target)) event.preventDefault();
    const controlWasHeld = this.controlHeld();
    this.keys.delete(event.code);
    if (isControl(event.code) && controlWasHeld && !this.controlHeld())
      this.itemEdge(false);
  };
  clear = () => {
    this.keys.clear();
    this.turn = undefined;
    this.turnId = undefined;
    this.balloonPending = false;
    this.itemEdges = [];
  };
  setEnabled(enabled: boolean) {
    if (this.enabled !== enabled) this.clear();
    this.enabled = enabled;
  }
  consumeActions() {
    this.balloonPending = false;
    this.itemEdges.shift();
  }
  private visibility = () => {
    if (document.hidden) this.clear();
  };
  private focus = (event: FocusEvent) => {
    if (editing(event.target)) this.clear();
  };
  constructor() {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.visibility);
    document.addEventListener("focusin", this.focus);
  }
  input(): LocalInput {
    const direction = [...this.keys]
      .reverse()
      .find((code) => code.startsWith("Arrow"));
    return {
      x: direction === "ArrowRight" ? 1 : direction === "ArrowLeft" ? -1 : 0,
      y: direction === "ArrowDown" ? 1 : direction === "ArrowUp" ? -1 : 0,
      turn: this.turn,
      turnId: this.turnId,
      balloon: this.balloonPending || this.keys.has("Space"),
      useItem: this.itemEdges[0] ?? this.controlHeld(),
    };
  }
  destroy() {
    this.clear();
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("visibilitychange", this.visibility);
    document.removeEventListener("focusin", this.focus);
  }
}

export interface GameController {
  destroy(removeCanvas: boolean): void;
  reset(): void;
}
let previousSoloArenaId: string | undefined;

export function mountGame(
  parent: HTMLElement,
  onState: (state: PracticeState) => void,
  session?: {
    initial: PracticeState;
    playerId?: string;
    frame: (input: LocalInput, delta: number) => PracticeState | null;
    restart: () => void;
    view: () => RoomView | null;
  },
): GameController {
  const keyboard = new GameKeyboard();
  const intro = createStartOverlay(parent);
  let introAt = performance.now(),
    observedAt = introAt,
    observedView: RoomView | null = null;
  const characterId = selectedCharacter();
  const solo = () => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const state = createArenaPractice(seed, previousSoloArenaId);
    previousSoloArenaId = state.arenaId;
    state.players[0].characterId = characterId;
    return state;
  };
  let state = session?.initial ?? solo(),
    stopped = false;
  class GameScene extends Phaser.Scene {
    private view!: GameRenderer;
    constructor() {
      super("game");
    }
    create() {
      this.view = new GameRenderer(
        this,
        parent,
        true,
        session?.playerId ?? "p1",
      );
      introAt = performance.now();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.view.destroy(),
      );
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
        parent.setAttribute("data-ready", "true"),
      );
    }
    update(_time: number, delta: number) {
      if (stopped) return;
      const now = performance.now();
      let waiting = now - introAt < C.countdownMs;
      let cue = startCue(now - introAt);
      if (session) {
        const view = session.view();
        if (view !== observedView) {
          observedView = view;
          observedAt = now;
        }
        waiting = view?.phase !== "PLAYING" || !!view.paused;
        cue =
          view?.phase === "COUNTDOWN" && view.countdownEndsAt !== null
            ? startCue(
                Math.min(
                  C.countdownMs - 1,
                  C.countdownMs -
                    (view.countdownEndsAt -
                      view.serverTime -
                      (now - observedAt)),
                ),
              )
            : view?.phase === "PLAYING" &&
                !view.paused &&
                (view.game?.time ?? Infinity) < START_MESSAGE_MS
              ? "Game Start!"
              : null;
      }
      intro.show(cue);
      parent.dataset.startPhase = waiting ? "waiting" : "playing";
      keyboard.setEnabled(!waiting);
      if (session) {
        state = session.frame(keyboard.input(), delta) ?? state;
        keyboard.consumeActions();
      } else if (!waiting && !document.hidden) {
        const before = state.tick;
        stepPractice(state, [keyboard.input()], Math.min(delta, C.maxFrameMs));
        // Preserve fast presses until a fixed simulation step actually consumes them.
        if (state.tick !== before) keyboard.consumeActions();
      }
      this.view.update(state, delta);
      onState(state);
    }
    resetTerrain() {
      this.view?.reset();
    }
  }
  arcadeAudio.beginSession();
  const scene = new GameScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: C.columns * C.tileSize,
    height: C.rows * C.tileSize,
    fps: { smoothStep: false },
    backgroundColor: "#cde1cd",
    scene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    render: { antialias: true },
  });
  parent.tabIndex = 0;
  parent.focus({ preventScroll: true });
  onState(state);
  return {
    destroy(removeCanvas) {
      stopped = true;
      arcadeAudio.endSession();
      keyboard.destroy();
      intro.destroy();
      parent.removeAttribute("data-ready");
      parent.removeAttribute("data-start-phase");
      game.destroy(removeCanvas);
    },
    reset() {
      keyboard.clear();
      if (session) session.restart();
      else {
        introAt = performance.now();
        keyboard.setEnabled(false);
        intro.show("3");
        parent.dataset.startPhase = "waiting";
        state = solo();
        scene.resetTerrain();
        arcadeAudio.beginSession();
        onState(state);
      }
      parent.focus({ preventScroll: true });
    },
  };
}
