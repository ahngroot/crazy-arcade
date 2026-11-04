import Phaser from "phaser";
import {
  createPractice,
  createCompetition,
  stepPractice,
  GAME_CONFIG as C,
  type PracticeState,
  type LocalInput,
} from "@bubble/shared";
import { GameRenderer } from "./renderer";
import { arcadeAudio } from "./audio";

const MOVEMENT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "Enter",
  "ControlLeft",
  "ControlRight",
]);

/** Owned by a single practice session; never attaches keyboard handlers to the menu. */
class PracticeKeyboard {
  private keys = new Set<string>();
  private pending = new Set<string>();
  private itemEdges: [boolean[], boolean[]] = [[], []];
  private itemEdge(code: string, pressed: boolean) {
    const index = code === "ControlLeft" ? 0 : code === "ControlRight" ? 1 : -1;
    if (index === -1) return;
    if (this.itemEdges[index].length < C.maxPendingInputs)
      this.itemEdges[index].push(pressed);
  }
  private down = (event: KeyboardEvent) => {
    if (!MOVEMENT_KEYS.has(event.code)) return;
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLButtonElement &&
        ["Space", "Enter", "ControlLeft", "ControlRight"].includes(event.code))
    )
      return;
    event.preventDefault();
    if (!this.keys.has(event.code) && !event.repeat)
      this.itemEdge(event.code, true);
    this.keys.add(event.code);
    if (!event.repeat) this.pending.add(event.code);
  };
  private up = (event: KeyboardEvent) => {
    if (MOVEMENT_KEYS.has(event.code)) {
      event.preventDefault();
      if (this.keys.has(event.code)) this.itemEdge(event.code, false);
      this.keys.delete(event.code);
    }
  };
  clear = () => {
    this.keys.clear();
    this.pending.clear();
    this.itemEdges = [[], []];
  };
  consumeActions() {
    this.pending.clear();
    for (const edges of this.itemEdges) edges.shift();
  }
  private visibility = () => {
    if (document.hidden) this.clear();
  };
  private focus = (event: FocusEvent) => {
    if (
      event.target instanceof HTMLButtonElement ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement
    )
      this.clear();
  };
  constructor() {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.visibility);
    document.addEventListener("focusin", this.focus);
  }
  inputs(): LocalInput[] {
    const has = (code: string) => Number(this.keys.has(code));
    const action = (code: string) =>
      this.pending.has(code) || this.keys.has(code);
    return [
      {
        x: has("KeyD") - has("KeyA"),
        y: has("KeyS") - has("KeyW"),
        balloon: action("Space"),
        useItem: this.itemEdges[0][0] ?? Boolean(has("ControlLeft")),
      },
      {
        x: has("ArrowRight") - has("ArrowLeft"),
        y: has("ArrowDown") - has("ArrowUp"),
        balloon: action("Enter"),
        useItem: this.itemEdges[1][0] ?? Boolean(has("ControlRight")),
      },
    ];
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

export interface PracticeController {
  destroy(removeCanvas: boolean): void;
  reset(): void;
}

export function mountPractice(
  parent: HTMLElement,
  onState: (state: PracticeState) => void,
  options: {
    competition?: boolean;
    durationMs?: number;
    remote?: {
      initial: PracticeState;
      frame: (inputs: LocalInput[], delta: number) => PracticeState | null;
      restart: () => void;
    };
  } = {},
): PracticeController {
  const keyboard = new PracticeKeyboard();
  const newState = () =>
    options.remote
      ? options.remote.initial
      : options.competition
        ? createCompetition(C.competitionSeed, options.durationMs ?? C.roundMs)
        : createPractice();
  let state = newState(),
    stopped = false;
  class PracticeScene extends Phaser.Scene {
    private view!: GameRenderer;
    constructor() {
      super("practice");
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
      const previousTick = state.tick;
      if (options.remote) {
        state = options.remote.frame(keyboard.inputs(), delta) ?? state;
        keyboard.consumeActions();
      } else if (!document.hidden)
        stepPractice(state, keyboard.inputs(), Math.min(delta, C.maxFrameMs));
      if (previousTick !== state.tick) keyboard.consumeActions();
      this.view.update(state, delta);
      onState(state);
    }
    resetTerrain() {
      this.view?.reset();
    }
  }
  arcadeAudio.beginSession();
  const scene = new PracticeScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: C.columns * C.tileSize,
    height: C.rows * C.tileSize,
    // Phaser smoothing deliberately shrinks slow/startup deltas. Simulation needs elapsed time.
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
      if (options.remote) {
        options.remote.restart();
        parent.focus({ preventScroll: true });
        return;
      }
      state = newState();
      arcadeAudio.beginSession();
      scene.resetTerrain();
      parent.focus({ preventScroll: true });
      onState(state);
    },
  };
}
