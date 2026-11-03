import Phaser from "phaser";
import {
  createPractice,
  stepPractice,
  GAME_CONFIG as C,
  type PracticeState,
  type PracticePlayer,
  type LocalInput,
} from "@bubble/shared";

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
]);

/** Owned by a single practice session; never attaches keyboard handlers to the menu. */
class PracticeKeyboard {
  private keys = new Set<string>();
  private pending = [false, false];
  private down = (event: KeyboardEvent) => {
    if (!MOVEMENT_KEYS.has(event.code)) return;
    if (
      event.target instanceof HTMLButtonElement &&
      ["Space", "Enter"].includes(event.code)
    )
      return;
    event.preventDefault();
    this.keys.add(event.code);
    if (!event.repeat && event.code === "Space") this.pending[0] = true;
    if (!event.repeat && event.code === "Enter") this.pending[1] = true;
  };
  private up = (event: KeyboardEvent) => {
    if (MOVEMENT_KEYS.has(event.code)) {
      event.preventDefault();
      this.keys.delete(event.code);
    }
  };
  clear = () => {
    this.keys.clear();
    this.pending = [false, false];
  };
  consumeActions() {
    this.pending = [false, false];
  }
  private visibility = () => {
    if (document.hidden) this.clear();
  };
  private focus = (event: FocusEvent) => {
    if (event.target instanceof HTMLButtonElement) this.clear();
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
    return [
      {
        x: has("KeyD") - has("KeyA"),
        y: has("KeyS") - has("KeyW"),
        balloon: this.pending[0] || this.keys.has("Space"),
      },
      {
        x: has("ArrowRight") - has("ArrowLeft"),
        y: has("ArrowDown") - has("ArrowUp"),
        balloon: this.pending[1] || this.keys.has("Enter"),
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

function drawMap(g: Phaser.GameObjects.Graphics, state: PracticeState) {
  const t = C.tileSize;
  g.clear();
  state.map.forEach((row, y) =>
    row.forEach((tile, x) => {
      const px = x * t,
        py = y * t;
      g.fillStyle(x < 7 ? 0xf2e2c7 : 0xcce5d3);
      g.fillRect(px, py, t, t);
      g.lineStyle(1, x < 7 ? 0xe7d4b5 : 0xb7d4bf);
      g.strokeRect(px, py, t, t);
      if (tile === "wall") {
        g.fillStyle(0x3d6650);
        g.fillRoundedRect(px + 2, py + 6, 36, 33, 6);
        g.fillStyle(0x739b74);
        g.fillRoundedRect(px + 2, py + 1, 36, 30, 6);
        g.fillStyle(0x9cbe8b);
        g.fillRoundedRect(px + 5, py + 3, 30, 7, 4);
        g.fillStyle(0xc9daa3, 0.5);
        g.fillCircle(px + 10, py + 17, 3);
      } else if (tile === "crate") {
        g.fillStyle(0x90603e);
        g.fillRoundedRect(px + 3, py + 7, 34, 32, 4);
        g.fillStyle(0xd5a064);
        g.fillRoundedRect(px + 3, py + 2, 34, 30, 4);
        g.lineStyle(3, 0xf4d199);
        g.strokeRect(px + 7, py + 6, 26, 22);
        g.lineBetween(px + 8, py + 7, px + 31, py + 27);
      }
    }),
  );
}

function drawPlayer(
  g: Phaser.GameObjects.Graphics,
  p: PracticePlayer,
  time: number,
) {
  if (p.status === "respawning") return;
  const x = p.position.x * C.tileSize,
    y = p.position.y * C.tileSize;
  const bounce = p.moving
    ? Math.sin(time / 55) * 2
    : Math.sin(time / 220) * 0.8;
  const color = p.team === "red" ? 0xf47a68 : 0x62b99a;
  const blink = p.invulnerableUntil > time && Math.floor(time / 100) % 2 === 0;
  g.fillStyle(0x264b3d, 0.2);
  g.fillEllipse(x, y + 8, 28, 10);
  g.fillStyle(color, blink ? 0.35 : 1);
  g.lineStyle(2, 0x344a42, blink ? 0.35 : 1);
  // Logical collision body is at the feet; artwork extends upward.
  const head = y - 9 + bounce;
  g.fillEllipse(x - 8, y + 7 + (p.moving ? bounce : 0), 10, 7);
  g.fillEllipse(x + 8, y + 7 - (p.moving ? bounce : 0), 10, 7);
  g.fillRoundedRect(x - 15, head - 17, 30, 29, 12);
  g.strokeRoundedRect(x - 15, head - 17, 30, 29, 12);
  g.fillEllipse(x - 9, head - 21, 7, 14);
  g.fillEllipse(x + 9, head - 21, 7, 14);
  if (p.facing !== "up") {
    const shift = p.facing === "left" ? -3 : p.facing === "right" ? 3 : 0;
    g.fillStyle(0xffe7cc, blink ? 0.35 : 1);
    g.fillRoundedRect(x - 12 + shift, head - 9, 24, 18, 8);
    g.fillStyle(0x293f37, blink ? 0.35 : 1);
    g.fillEllipse(x - 5 + shift, head - 2, 3, 5);
    g.fillEllipse(x + 5 + shift, head - 2, 3, 5);
    g.lineStyle(1.5, 0x293f37);
    g.lineBetween(x - 2 + shift, head + 4, x + 2 + shift, head + 4);
    g.fillStyle(0xf1a193, 0.7);
    g.fillEllipse(x - 9 + shift, head + 3, 4, 2);
    g.fillEllipse(x + 9 + shift, head + 3, 4, 2);
  }
  if (p.status === "trapped") {
    g.fillStyle(0x9ee9ff, 0.4);
    g.fillCircle(x, y - 7, 24);
    g.lineStyle(3, 0x4bbde1);
    g.strokeCircle(x, y - 7, 24);
    g.lineStyle(2, 0xe1faff);
    g.beginPath();
    g.arc(x, y - 7, 19, 3.7, 4.8);
    g.strokePath();
    g.lineStyle(2, 0x43626b);
    g.lineBetween(x - 6, y - 13, x - 3, y - 10);
    g.lineBetween(x + 6, y - 13, x + 3, y - 10);
  }
}

export interface PracticeController {
  destroy(removeCanvas: boolean): void;
  reset(): void;
}

export function mountPractice(
  parent: HTMLElement,
  onState: (state: PracticeState) => void,
): PracticeController {
  const keyboard = new PracticeKeyboard();
  let state = createPractice(),
    stopped = false;
  class PracticeScene extends Phaser.Scene {
    private terrain!: Phaser.GameObjects.Graphics;
    private actors!: Phaser.GameObjects.Graphics;
    private revision = -1;
    constructor() {
      super("practice");
    }
    create() {
      this.terrain = this.add.graphics();
      this.actors = this.add.graphics();
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
        parent.setAttribute("data-ready", "true"),
      );
    }
    update(_time: number, delta: number) {
      if (stopped) return;
      // Never catch up a hidden tab with minutes of inputs. Keyboard clears on blur.
      const previousTick = state.tick;
      if (!document.hidden)
        stepPractice(state, keyboard.inputs(), Math.min(delta, C.maxFrameMs));
      if (previousTick !== state.tick) keyboard.consumeActions();
      if (this.revision !== state.mapRevision) {
        drawMap(this.terrain, state);
        this.revision = state.mapRevision;
      }
      const g = this.actors;
      g.clear();
      const t = C.tileSize;
      for (const item of state.items) {
        const x = (item.x + 0.5) * t,
          y = (item.y + 0.5) * t;
        const alpha = item.availableAt > state.time ? 0.45 : 1;
        g.fillStyle(0xfffcdf, alpha);
        g.fillRoundedRect(x - 12, y - 12, 24, 24, 7);
        g.lineStyle(2, 0xe7bf61, alpha);
        g.strokeRoundedRect(x - 12, y - 12, 24, 24, 7);
        if (item.kind === "balloon") {
          g.fillStyle(0x68bee0, alpha);
          g.fillCircle(x, y, 7);
          g.fillStyle(0xffffff);
          g.fillCircle(x - 2, y - 3, 2);
        } else if (item.kind === "range") {
          g.lineStyle(4, 0xe48a54, alpha);
          g.lineBetween(x - 7, y, x + 7, y);
          g.lineBetween(x, y - 7, x, y + 7);
        } else {
          g.fillStyle(0x85b879, alpha);
          g.fillTriangle(x - 6, y - 7, x + 7, y, x - 6, y + 7);
        }
      }
      for (const b of state.balloons) {
        const x = (b.x + 0.5) * t,
          y = (b.y + 0.5) * t,
          pulse =
            1 +
            Math.sin(
              state.time / (b.explodesAt - state.time < 600 ? 45 : 130),
            ) *
              0.07;
        g.fillStyle(0x245a68, 0.2);
        g.fillEllipse(x, y + 13, 30, 10);
        g.fillStyle(0x64cde9);
        g.lineStyle(2, 0x3289ad);
        g.fillEllipse(x, y, 29 * pulse, 31 / pulse);
        g.strokeEllipse(x, y, 29 * pulse, 31 / pulse);
        g.fillStyle(0xd9faff);
        g.fillEllipse(x - 5, y - 6, 9, 5);
        g.fillStyle(0xffffff);
        g.fillCircle(x - 6, y - 7, 2);
      }
      for (const blast of state.blasts)
        for (const cell of blast.cells) {
          const x = cell.x * t,
            y = cell.y * t,
            center = blast.cells[0];
          g.fillStyle(0x4cbce3, 0.8);
          g.fillRect(x, y, t, t);
          g.fillStyle(0xd0faff, 0.9);
          if (cell.x === center.x && cell.y === center.y) {
            g.fillRoundedRect(x + 3, y + 14, t - 6, 12, 5);
            g.fillRoundedRect(x + 14, y + 3, 12, t - 6, 5);
          } else if (cell.x === center.x)
            g.fillRoundedRect(x + 14, y, 12, t, 5);
          else g.fillRoundedRect(x, y + 14, t, 12, 5);
          for (let n = 0; n < 3; n++) {
            g.fillStyle(0xecfdff, 0.8);
            g.fillCircle(
              x + 6 + ((state.tick * 2 + n * 13) % 28),
              y + 6 + ((state.tick + n * 9) % 28),
              2,
            );
          }
        }
      for (const p of [...state.players].sort(
        (a, b) => a.position.y - b.position.y,
      ))
        drawPlayer(g, p, state.time);
      onState(state);
    }
    resetTerrain() {
      this.revision = -1;
    }
  }
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
  parent.focus();
  onState(state);
  return {
    destroy(removeCanvas) {
      stopped = true;
      keyboard.destroy();
      parent.removeAttribute("data-ready");
      game.destroy(removeCanvas);
    },
    reset() {
      keyboard.clear();
      state = createPractice();
      scene.resetTerrain();
      parent.focus();
      onState(state);
    },
  };
}
