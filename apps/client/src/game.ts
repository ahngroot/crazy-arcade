import Phaser from "phaser";
import {
  GAME_CONFIG as C,
  createSoloPractice,
  stepPractice,
  type PracticeState,
  type LocalInput,
} from "@bubble/shared";
import { GameRenderer } from "./renderer";
import { arcadeAudio } from "./audio";

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

/** One keyboard controls one character in solo practice or online play. */
class GameKeyboard {
  private keys = new Set<string>();
  private balloonPending = false;
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
    const controlWasHeld = this.controlHeld();
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
    this.balloonPending = false;
    this.itemEdges = [];
  };
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
    const has = (code: string) => Number(this.keys.has(code));
    return {
      x: has("ArrowRight") - has("ArrowLeft"),
      y: has("ArrowDown") - has("ArrowUp"),
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

export function mountGame(
  parent: HTMLElement,
  onState: (state: PracticeState) => void,
  session?: {
    initial: PracticeState;
    frame: (input: LocalInput, delta: number) => PracticeState | null;
    restart: () => void;
  },
): GameController {
  const keyboard = new GameKeyboard();
  let state = session?.initial ?? createSoloPractice(),
    stopped = false;
  class GameScene extends Phaser.Scene {
    private view!: GameRenderer;
    constructor() {
      super("game");
    }
    create() {
      this.view = new GameRenderer(this, parent);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.view.destroy(),
      );
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
        parent.setAttribute("data-ready", "true"),
      );
    }
    update(_time: number, delta: number) {
      if (stopped) return;
      if (session) {
        state = session.frame(keyboard.input(), delta) ?? state;
        keyboard.consumeActions();
      } else if (!document.hidden) {
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
      parent.removeAttribute("data-ready");
      game.destroy(removeCanvas);
    },
    reset() {
      keyboard.clear();
      if (session) session.restart();
      else {
        state = createSoloPractice();
        scene.resetTerrain();
        arcadeAudio.beginSession();
        onState(state);
      }
      parent.focus({ preventScroll: true });
    },
  };
}
