import type Phaser from "phaser";
import type { Team, ItemKind, Facing, Tile } from "@bubble/shared";
import activeItemsUrl from "./assets/active-items.png";
import charactersUrl from "./assets/characters.png";
import passiveItemsUrl from "./assets/passive-items.png";
import placedBalloonUrl from "./assets/placed-balloon.png";
import speedUrl from "./assets/speed.png";

// One reference-based sheet supplies both world pickups and inventory icons.
const activeItemsImage = new Image();
activeItemsImage.src = activeItemsUrl;
await activeItemsImage.decode();
const charactersImage = new Image();
charactersImage.src = charactersUrl;
await charactersImage.decode();
const passiveItemsImage = new Image();
passiveItemsImage.src = passiveItemsUrl;
await passiveItemsImage.decode();
const placedBalloonImage = new Image();
placedBalloonImage.src = placedBalloonUrl;
await placedBalloonImage.decode();
const speedImage = new Image();
speedImage.src = speedUrl;
await speedImage.decode();
const passiveIndex: Partial<Record<ItemKind, number>> = {
  balloon: 0,
  ultra: 1,
  range: 2,
};
function passiveIcon(c: Ctx, index: number, size: number) {
  const cell = passiveItemsImage.naturalWidth / 3;
  c.imageSmoothingEnabled = false;
  c.drawImage(
    passiveItemsImage,
    index * cell,
    0,
    cell,
    passiveItemsImage.naturalHeight,
    0,
    0,
    size,
    size,
  );
}
export const keyCharacter = (id: number, left: boolean, frame: number) =>
  `art-character-${id}-${left ? 1 : 0}-${frame}`;

export const ART = {
  playerWidth: 42,
  playerHeight: 52.5,
  monsterWidth: 32,
  monsterHeight: 36,
  particleLimit: 220,
} as const;
export const COLORS = {
  ink: "#254856",
  red: "#fb806d",
  redDark: "#ce5063",
  green: "#64d0af",
  greenDark: "#329f9c",
  water: "#47c9f2",
  gold: "#ffcf57",
};
export type Pose = "idle" | "walk" | "trapped" | "defeat" | "win" | "lose";
type Ctx = CanvasRenderingContext2D;
type Paint = string | CanvasGradient | CanvasPattern;
const oval = (
  c: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: Paint,
  stroke?: string,
) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
};
const rounded = (
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: Paint,
  stroke?: string,
) => {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
};
const line = (c: Ctx, points: number[], color: string, width = 2) => {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
};
const gradient = (
  c: Ctx,
  x: number,
  y: number,
  r: number,
  light: string,
  dark: string,
) => {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, 1, x, y, r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
};
const shape = (c: Ctx, points: number[], fill: string, stroke?: string) => {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
};

function leaf(
  c: Ctx,
  x: number,
  y: number,
  color: string,
  angle = 0,
  size = 1,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(size, size);
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(-12, -3, -9, -17, 0, -20);
  c.bezierCurveTo(9, -15, 11, -5, 0, 0);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = COLORS.ink;
  c.lineWidth = 1.6;
  c.stroke();
  line(c, [0, -3, 0, -14], "#ffffff85", 1.5);
  c.restore();
}
function star(c: Ctx, x: number, y: number, r: number, fill: string) {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2,
      rad = i % 2 ? r * 0.45 : r;
    points.push(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  shape(c, points, fill);
}

function character(c: Ctx, team: Team, dir: Facing, pose: Pose, frame: number) {
  const body = team === "red" ? COLORS.red : COLORS.green,
    dark = team === "red" ? COLORS.redDark : COLORS.greenDark;
  const walking = pose === "walk",
    swing = walking ? [0, 1, 0, -1][frame] : 0;
  const bob = walking ? Math.abs(swing) * 1.5 : (frame % 2) * 0.6;
  c.lineWidth = 2;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.save();
  c.translate(0, -bob);
  const raised = pose === "win" || pose === "trapped";
  // The little boots, overalls and scarf give a readable silhouette at tile scale.
  oval(c, 23, 69 + swing * 3, 9, 5, dark, COLORS.ink);
  oval(c, 41, 69 - swing * 3, 9, 5, dark, COLORS.ink);
  rounded(c, 19, 49, 26, 19, 8, body, COLORS.ink);
  rounded(c, 24, 53, 16, 13, 5, "#fff4d5");
  oval(c, 32, 60, 2, 2, dark);
  if (dir === "left" || dir === "right") {
    const sign = dir === "left" ? 1 : -1;
    shape(
      c,
      [
        32 + sign * 11,
        49,
        32 + sign * 23,
        46 + swing * 3,
        32 + sign * 20,
        54 + swing * 3,
        32 + sign * 12,
        55,
      ],
      "#ffe19a",
      COLORS.ink,
    );
  }
  oval(c, 16, raised ? 40 : 55 + swing * 3, 5, 7, body, COLORS.ink);
  oval(c, 48, raised ? 40 : 55 - swing * 3, 5, 7, body, COLORS.ink);
  c.fillStyle = gradient(
    c,
    32,
    30,
    28,
    team === "red" ? "#ffb68e" : "#aff1c4",
    body,
  );
  c.beginPath();
  c.ellipse(32, 32, 25, 23, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = COLORS.ink;
  c.stroke();
  leaf(c, 24, 13, team === "red" ? "#ffab80" : "#a0e9b8", -0.35, 0.65);
  leaf(c, 39, 13, body, 0.35, 0.65);
  oval(c, 20, 18, 7, 3, "#ffffff65");
  if (dir === "up" && pose !== "win" && pose !== "lose" && pose !== "trapped") {
    c.setLineDash([2, 3]);
    c.strokeStyle = dark;
    c.beginPath();
    c.arc(32, 32, 17, 0.3, Math.PI - 0.3);
    c.stroke();
    c.setLineDash([]);
    leaf(c, 32, 44, "#fff3cc", 0, 0.45);
  } else {
    const shift = dir === "left" ? -5 : dir === "right" ? 5 : 0;
    rounded(c, 13 + shift, 25, 38, 25, 12, "#fff3dd", dark);
    oval(c, 21 + shift, 40, 4, 2.6, "#f89e9d99");
    oval(c, 43 + shift, 40, 4, 2.6, "#f89e9d99");
    const eyeY = 34,
      blink = (pose === "idle" && frame === 2) || pose === "win";
    for (const x of [25 + shift, 39 + shift]) {
      if (pose === "defeat") {
        line(c, [x - 3, eyeY - 3, x + 3, eyeY + 3], COLORS.ink, 2);
        line(c, [x + 3, eyeY - 3, x - 3, eyeY + 3], COLORS.ink, 2);
      } else if (blink) {
        c.beginPath();
        c.arc(x, eyeY + 1, 3, Math.PI, Math.PI * 2);
        c.strokeStyle = COLORS.ink;
        c.stroke();
      } else {
        oval(c, x, eyeY, 3.7, 5.5, "#fff");
        oval(
          c,
          x + (dir === "left" ? -1 : dir === "right" ? 1 : 0),
          eyeY + 0.6,
          2.8,
          4.2,
          COLORS.ink,
        );
        oval(c, x - 1, eyeY - 1.2, 1.2, 1.5, "#fff");
      }
    }
    if (pose === "trapped") {
      line(c, [20 + shift, 24, 27 + shift, 27], COLORS.ink, 1.6);
      line(c, [37 + shift, 27, 44 + shift, 24], COLORS.ink, 1.6);
      oval(c, 32 + shift, 43, 3, 4, "#98656b", COLORS.ink);
      c.save();
      c.translate(53, 24);
      c.scale(0.55, 0.55);
      drop(c, "#9deaff");
      c.restore();
    } else if (pose === "lose") {
      c.beginPath();
      c.arc(32 + shift, 47, 4, Math.PI, Math.PI * 2);
      c.strokeStyle = COLORS.ink;
      c.stroke();
      oval(c, 22 + shift, 43, 2, 4, "#80d8f8");
    } else {
      c.beginPath();
      c.arc(32 + shift, 40, pose === "win" ? 5 : 3, 0, Math.PI);
      c.fillStyle = pose === "win" ? "#d76f7d" : "#fff3dd";
      c.fill();
      c.strokeStyle = COLORS.ink;
      c.stroke();
    }
  }
  c.restore();
}

function monster(c: Ctx, kind: "normal" | "chaser" | "golden", frame: number) {
  const bob = [0, 2, 0, -1][frame],
    x = 28,
    y = 28 - bob;
  const main =
    kind === "chaser" ? "#ad85d9" : kind === "golden" ? "#ffc947" : "#b9df77";
  c.lineWidth = 2;
  c.lineJoin = "round";
  c.lineCap = "round";
  if (kind === "golden") {
    oval(c, x, y, 24, 24, "#ffe8972f");
    star(c, 7 + frame * 2, 13, 4, "#ffdc64");
    star(c, 47, 35 - frame * 2, 3, "#fff2a3");
  }
  if (kind === "chaser") {
    for (const [sx, sy, a] of [
      [10, 23, -0.6],
      [45, 23, 0.6],
      [17, 10, -0.4],
      [38, 10, 0.4],
    ]) {
      c.save();
      c.translate(sx, sy);
      c.rotate(a);
      shape(c, [-5, 5, 0, -9, 6, 5], "#936bbf", COLORS.ink);
      c.restore();
    }
  }
  oval(c, 19, 45 + bob, 8, 4, kind === "golden" ? "#e9a932" : main, COLORS.ink);
  oval(c, 37, 45 - bob, 8, 4, kind === "golden" ? "#e9a932" : main, COLORS.ink);
  c.fillStyle = gradient(
    c,
    x,
    y,
    23,
    kind === "chaser" ? "#dfbbef" : kind === "golden" ? "#fff6a3" : "#eaffac",
    main,
  );
  c.beginPath();
  c.ellipse(x, y, 20, 18, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = COLORS.ink;
  c.stroke();
  if (kind !== "chaser") {
    leaf(c, 29, 15 - bob, kind === "golden" ? "#ffe46a" : "#8bcf7c", 0.5, 0.55);
  }
  if (kind === "golden") {
    shape(
      c,
      [
        18,
        15 - bob,
        17,
        6 - bob,
        24,
        11 - bob,
        28,
        4 - bob,
        33,
        11 - bob,
        40,
        6 - bob,
        38,
        15 - bob,
      ],
      "#ffd958",
      COLORS.ink,
    );
    star(c, 28, 14 - bob, 3, "#fff9d9");
  }
  rounded(c, 14, y - 4, 28, 17, 7, kind === "chaser" ? "#ead8f3" : "#fff5ce");
  for (const ex of [21, 35]) {
    oval(c, ex, y + 1, 3, 4.5, COLORS.ink);
    oval(c, ex - 0.8, y - 0.5, 1, 1.3, "#fff");
  }
  if (kind === "chaser") {
    line(c, [17, y - 7, 24, y - 4], COLORS.ink);
    line(c, [32, y - 4, 39, y - 7], COLORS.ink);
    shape(c, [24, y + 8, 32, y + 8, 30, y + 13], "#fff", COLORS.ink);
  } else {
    c.beginPath();
    c.arc(28, y + 6, 3.5, 0, Math.PI);
    c.strokeStyle = COLORS.ink;
    c.stroke();
  }
  oval(c, 17, y + 7, 3, 1.8, "#f49b8c88");
  oval(c, 39, y + 7, 3, 1.8, "#f49b8c88");
  oval(c, 20, y - 11, 6, 2.5, "#ffffff77");
}

function drop(c: Ctx, color = COLORS.water) {
  c.beginPath();
  c.moveTo(0, -12);
  c.bezierCurveTo(3, -5, 9, 0, 9, 5);
  c.bezierCurveTo(9, 17, -9, 17, -9, 5);
  c.bezierCurveTo(-9, 0, -3, -5, 0, -12);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = "#227caa";
  c.lineWidth = 1.4;
  c.stroke();
  oval(c, -3, 3, 2, 4, "#e3faff");
}
function balloon(c: Ctx) {
  c.lineWidth = 2;
  c.fillStyle = gradient(c, 24, 22, 22, "#c4f5ff", "#2ba6d9");
  c.beginPath();
  c.ellipse(24, 24, 18, 19, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#236b98";
  c.stroke();
  c.beginPath();
  c.arc(24, 24, 15, 0.2, 2.9);
  c.strokeStyle = "#81e3f9";
  c.stroke();
  oval(c, 17, 15, 6, 4, "#f0fdff");
  oval(c, 31, 31, 3, 2, "#a8f0ff");
  shape(c, [20, 42, 24, 38, 28, 42], "#51bce7", "#236b98");
}
function tile(
  c: Ctx,
  kind:
    | Tile
    | "ground-red"
    | "ground-green"
    | "ground-battle"
    | "wall-battle"
    | "crate-battle",
  variant = 0,
) {
  c.lineWidth = 1.5;
  if (kind === "ground-battle") {
    rounded(c, 0, 0, 40, 40, 2, variant ? "#e6f0f4" : "#f8edd9");
    line(c, [0, 39, 39, 39, 39, 0], "#a1bac480", 1);
    line(c, [1, 37, 1, 1, 37, 1], "#ffffffa0", 1);
    rounded(c, 5, 5, 30, 30, 2, "#ffffff14", "#ffffff35");
  } else if (kind === "wall-battle") {
    rounded(c, 2, 9, 36, 37, 5, "#3d6683", "#2f536e");
    rounded(c, 1, 2, 38, 32, 6, "#85b6d2", "#375f79");
    rounded(c, 5, 5, 30, 23, 4, "#b8def0", "#6f9db6");
    line(c, [7, 8, 32, 8], "#e6f8ff", 2);
    line(c, [5, 35, 35, 35], "#284b69", 2);
  } else if (kind === "crate-battle") {
    const colors = [
      ["#f4938a", "#c75f5d", "#ffe0cd"],
      ["#ffda7e", "#bd8a40", "#fff0b9"],
      ["#8bd5cf", "#4c9eaa", "#d6f6e6"],
    ][variant % 3];
    rounded(c, 3, 10, 34, 35, 4, colors[1], "#675d68");
    rounded(c, 2, 2, 36, 32, 5, colors[0], colors[1]);
    rounded(c, 7, 6, 26, 22, 3, colors[2], colors[1]);
    line(c, [20, 3, 20, 32], colors[1], 3);
    line(c, [3, 17, 37, 17], colors[1], 3);
    line(c, [5, 4, 34, 4], "#ffffffa0", 2);
  } else if (kind === "ground-red" || kind === "ground-green") {
    const red = kind === "ground-red";
    const gradient = c.createLinearGradient(0, 0, 40, 40);
    gradient.addColorStop(0, red ? "#ffe5ba" : "#cef0cb");
    gradient.addColorStop(1, red ? "#efd0a3" : "#aad9bd");
    rounded(c, 0, 0, 40, 40, 3, gradient);
    line(c, [1, 39, 39, 39, 39, 1], red ? "#cfae8570" : "#83bba570", 1);
    line(c, [1, 38, 1, 1, 38, 1], "#ffffff65", 1);
    for (const [x, y] of [
      [8, 11],
      [28, 30],
      [32, 6],
    ])
      oval(c, x + variant * 2, y, 1, 0.8, red ? "#c9ac8540" : "#639c7f30");
    if (variant) {
      line(c, [7, 31, 10, 27, 13, 31], "#75ac7760", 1);
      oval(c, 31, 11, 1.6, 1.5, "#ffffff70");
    }
  } else if (kind === "wall") {
    rounded(c, 2, 12, 36, 34, 7, "#54816a", COLORS.ink);
    rounded(c, 4, 13, 32, 29, 6, "#80aa79");
    line(c, [5, 35, 35, 35], "#47785b", 2);
    const g = c.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, "#cbeb99");
    g.addColorStop(0.5, "#88c37d");
    g.addColorStop(1, "#5fa779");
    rounded(c, 1, 3, 38, 31, 10, g, COLORS.ink);
    for (const [x, y, r] of [
      [10, 11, 6],
      [28, 9, 7],
      [20, 23, 6],
    ]) {
      oval(c, x, y, r, r * 0.7, "#b5df9166");
      line(c, [x - 3, y + 1, x, y - 2, x + 3, y + 1], "#6ba571", 1);
    }
    line(c, [7, 7, 15, 5], "#e5f9ba", 2);
    oval(c, 30, 25, 2, 2, "#e0ee9b");
  } else if (kind === "crate") {
    rounded(c, 3, 6, 34, 38, 5, "#a66a45", COLORS.ink);
    const g = c.createLinearGradient(0, 0, 40, 40);
    g.addColorStop(0, "#ffe0a0");
    g.addColorStop(1, "#dba55d");
    rounded(c, 3, 2, 34, 33, 5, g, COLORS.ink);
    line(c, [7, 13, 33, 13], "#bc874d", 1);
    line(c, [7, 25, 33, 25], "#bc874d", 1);
    shape(c, [7, 5, 11, 4, 33, 29, 29, 32], "#f8d08d", "#b5814a");
    shape(c, [29, 4, 33, 6, 11, 31, 7, 28], "#ffdf9e", "#b5814a");
    for (const [x, y] of [
      [8, 8],
      [32, 8],
      [8, 29],
      [32, 29],
    ])
      oval(c, x, y, 1.1, 1.1, "#976846");
    oval(c, 20, 18, 5.5, 5.5, "#fff0ba");
    leaf(c, 20, 21, "#92b86e", 0.4, 0.3);
  }
}

function item(c: Ctx, kind: ItemKind) {
  if (kind === "speed") {
    c.imageSmoothingEnabled = false;
    c.drawImage(speedImage, 0, 0, 36, 36);
    return;
  }
  const index = passiveIndex[kind];
  if (index !== undefined) {
    passiveIcon(c, index, 36);
    return;
  }
  if (kind === "needle" || kind === "shield") {
    const half = activeItemsImage.naturalWidth / 2;
    c.imageSmoothingEnabled = false;
    c.drawImage(
      activeItemsImage,
      kind === "needle" ? 0 : half,
      0,
      half,
      activeItemsImage.naturalHeight,
      0,
      0,
      36,
      36,
    );
    return;
  }
  c.lineWidth = 1.6;
  rounded(c, 3, 3, 30, 30, 9, "#fff9dc", "#d8a555");
  rounded(c, 5, 5, 26, 25, 7, "#fffff1", "#fff");
  c.save();
  c.translate(18, 18);
  if (kind === "balloon") {
    c.scale(0.52, 0.52);
    c.translate(-24, -24);
    balloon(c);
  } else if (kind === "range") {
    shape(
      c,
      [-4, -12, 4, -12, 3, -3, 10, 8, 7, 12, -7, 12, -10, 8, -3, -3],
      "#28c6ff",
      "#2472b5",
    );
    oval(c, 0, -12, 5, 2, "#ffad34");
    line(c, [-3, 1, -5, 7, -2, 8], "#dcfaff", 2);
  } else if (kind === "ultra") {
    star(c, 0, 0, 15, "#6d35c6");
    oval(c, 0, 0, 9, 11, "#ffdc38", "#6938b0");
    oval(c, -3, -2, 2, 3, "#fff");
    oval(c, 3, -2, 2, 3, "#fff");
  } else if (kind === "glove") {
    rounded(c, -7, -10, 14, 19, 6, "#f02b32", "#a71c29");
    oval(c, 7, -1, 4, 6, "#ff4344");
    rounded(c, -6, 7, 12, 5, 2, "#fff", "#aaa");
  } else if (kind === "shoes") {
    rounded(c, -7, -10, 13, 16, 4, "#ffb426", "#b87a27");
    oval(c, 0, -9, 7, 3, "#1678ce", "#ffcb3d");
    rounded(c, -10, 2, 22, 10, 5, "#298fd7", "#215c95");
    line(c, [-8, 12, 10, 12], "#fff", 3);
  } else if (kind === "ghost") {
    shape(
      c,
      [-8, 10, -7, -4, -4, -10, 4, -10, 7, -4, 9, 10, 4, 7, 0, 11, -4, 7],
      "#c2c8cd",
      "#7e858c",
    );
    oval(c, -3, -3, 2, 3, "#fff");
    oval(c, 3, -3, 2, 3, "#fff");
  } else {
    leaf(c, -1, -1, "#91c67c", -0.7, 0.45);
    leaf(c, 2, -1, "#b8db83", 0.6, 0.4);
    shape(c, [-5, -1, 6, 0, 3, 9, -2, 12, -4, 7], "#ffd178", "#c58b45");
    line(c, [-3, 6, -8, 8, -7, 12], "#c58b45", 1.4);
  }
  c.restore();
}

const keyPlayer = (team: Team, pose: Pose, dir: Facing, frame: number) =>
  `art-player-${team}-${pose}-${dir}-${frame}`;
export { keyPlayer };

export function installArt(scene: Phaser.Scene) {
  const make = (
    key: string,
    w: number,
    h: number,
    draw: (ctx: Ctx) => void,
  ) => {
    if (scene.textures.exists(key)) return;
    const canvas = document.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D drawing is unavailable");
    ctx.scale(2, 2);
    draw(ctx);
    scene.textures.addCanvas(key, canvas);
  };
  for (const team of ["red", "green"] as const)
    for (const pose of [
      "idle",
      "walk",
      "trapped",
      "defeat",
      "win",
      "lose",
    ] as const)
      for (const dir of ["up", "down", "left", "right"] as const)
        for (let f = 0; f < 4; f++)
          make(keyPlayer(team, pose, dir, f), 64, 80, (c) =>
            character(c, team, dir, pose, f),
          );
  for (let id = 0; id < 13; id++)
    for (const left of [false, true])
      for (let frame = 0; frame < 4; frame++)
        make(keyCharacter(id, left, frame), 64, 80, (c) => {
          const cell = charactersImage.naturalWidth / 4;
          c.imageSmoothingEnabled = false;
          c.save();
          c.translate(32, 40);
          c.scale(left ? -1 : 1, 1);
          c.rotate(frame === 1 ? -0.035 : frame === 3 ? 0.035 : 0);
          c.drawImage(
            charactersImage,
            (id % 4) * cell,
            Math.floor(id / 4) * cell,
            cell,
            cell,
            -32,
            -40 - (frame % 2 ? 2 : 0),
            64,
            80,
          );
          c.restore();
        });
  for (const kind of ["normal", "chaser", "golden"] as const)
    for (let f = 0; f < 4; f++)
      make(`art-monster-${kind}-${f}`, 56, 56, (c) => monster(c, kind, f));
  for (const team of ["red", "green"] as const)
    for (let variant = 0; variant < 2; variant++)
      make(`art-ground-${team}-${variant}`, 40, 40, (c) =>
        tile(c, `ground-${team}`, variant),
      );
  for (const kind of ["wall", "crate"] as const)
    make(`art-${kind}`, 40, 48, (c) => tile(c, kind));
  for (let variant = 0; variant < 2; variant++)
    make(`art-ground-battle-${variant}`, 40, 40, (c) =>
      tile(c, "ground-battle", variant),
    );
  make("art-wall-battle", 40, 48, (c) => tile(c, "wall-battle"));
  for (let variant = 0; variant < 3; variant++)
    make(`art-crate-battle-${variant}`, 40, 48, (c) =>
      tile(c, "crate-battle", variant),
    );
  for (const kind of [
    "balloon",
    "range",
    "speed",
    "needle",
    "shield",
    "power",
    "ultra",
    "glove",
    "shoes",
    "ghost",
  ] as const)
    make(`art-item-${kind}`, 36, 38, (c) => item(c, kind));
  make("art-balloon", 48, 48, (c) => {
    c.imageSmoothingEnabled = false;
    c.drawImage(placedBalloonImage, 0, 0, 48, 48);
  });
  make("art-shadow", 40, 16, (c) => oval(c, 20, 8, 18, 5, "#28545630"));
  make("art-drop", 24, 32, (c) => {
    c.translate(12, 14);
    drop(c);
  });
  make("art-star", 20, 20, (c) => {
    star(c, 10, 10, 9, "#ffe48b");
    star(c, 10, 10, 5, "#fff9de");
  });
  make("art-wood", 16, 16, (c) => {
    shape(c, [2, 2, 13, 4, 15, 13, 4, 11], "#f3c17b", "#a9794a");
  });
  make("art-fallback", 40, 40, (c) => {
    oval(c, 20, 20, 15, 16, "#8dd8dd", COLORS.ink);
    oval(c, 15, 18, 2, 3, COLORS.ink);
    oval(c, 25, 18, 2, 3, COLORS.ink);
  });
}

export function safeTexture(scene: Phaser.Scene, key: string) {
  return scene.textures.exists(key) ? key : "art-fallback";
}
let portraitId = 0;
export function portraitSvg(team: Team) {
  const id = `portrait-${team}-${portraitId++}`,
    main = team === "red" ? COLORS.red : COLORS.green;
  return `<svg viewBox="0 0 80 80" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${id}"><stop stop-color="${team === "red" ? "#ffd0a0" : "#c7f7cc"}"/><stop offset="1" stop-color="${main}"/></radialGradient></defs><ellipse cx="40" cy="72" rx="25" ry="5" fill="#264b3d22"/><path d="M25 59Q40 46 55 59L58 72H22Z" fill="${main}" stroke="#254856" stroke-width="2"/><path d="M23 68L12 58M57 68L68 58" stroke="${main}" stroke-width="9" stroke-linecap="round"/><ellipse cx="40" cy="38" rx="29" ry="27" fill="url(#${id})" stroke="#254856" stroke-width="2.5"/><path d="M29 16Q12 10 22 1Q36 2 29 16M49 16Q63 8 56 1Q42 0 49 16" fill="${main}" stroke="#254856" stroke-width="2"/><rect x="18" y="31" width="44" height="28" rx="13" fill="#fff3dd"/><ellipse cx="26" cy="48" rx="5" ry="3" fill="#f7b3a5"/><ellipse cx="54" cy="48" rx="5" ry="3" fill="#f7b3a5"/><g class="portrait-eyes"><ellipse cx="32" cy="41" rx="3.5" ry="5.2" fill="#254856"/><ellipse cx="48" cy="41" rx="3.5" ry="5.2" fill="#254856"/><circle cx="31" cy="39" r="1.2" fill="#fff"/><circle cx="47" cy="39" r="1.2" fill="#fff"/></g><path class="portrait-smile" d="M35 49Q40 56 45 49" fill="#e78e98" stroke="#254856" stroke-width="1.8"/><path class="portrait-frown" d="M35 54Q40 48 45 54" fill="none" stroke="#254856" stroke-width="2"/><ellipse class="portrait-gasp" cx="40" cy="52" rx="3" ry="4" fill="#bc7984" stroke="#254856" stroke-width="1.5"/><path d="M24 22L34 19" stroke="#fff" stroke-opacity=".65" stroke-width="4" stroke-linecap="round"/></svg>`;
}

export function itemSvg(kind: ItemKind) {
  if (kind === "speed")
    return `<svg viewBox="0 0 ${speedImage.naturalWidth} ${speedImage.naturalHeight}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><image href="${speedUrl}" width="${speedImage.naturalWidth}" height="${speedImage.naturalHeight}" style="image-rendering:pixelated"/></svg>`;
  const index = passiveIndex[kind];
  if (index !== undefined) {
    const cell = passiveItemsImage.naturalWidth / 3;
    return `<svg viewBox="${index * cell} 0 ${cell} ${passiveItemsImage.naturalHeight}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><image href="${passiveItemsUrl}" width="${passiveItemsImage.naturalWidth}" height="${passiveItemsImage.naturalHeight}" style="image-rendering:pixelated"/></svg>`;
  }
  if (kind === "needle" || kind === "shield") {
    const half = activeItemsImage.naturalWidth / 2;
    return `<svg viewBox="${kind === "needle" ? 0 : half} 0 ${half} ${activeItemsImage.naturalHeight}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><image href="${activeItemsUrl}" width="${activeItemsImage.naturalWidth}" height="${activeItemsImage.naturalHeight}" style="image-rendering:pixelated"/></svg>`;
  }
  const icons: Record<
    Exclude<ItemKind, "needle" | "shield" | "speed">,
    string
  > = {
    ultra:
      '<path d="M18 2l4 8 10-3-4 11 5 8-11-1-4 9-5-9-10 1 5-9-4-9 10 2Z" fill="#7534c7"/><ellipse cx="18" cy="18" rx="8" ry="10" fill="#ffdb37"/>',
    glove:
      '<rect x="10" y="5" width="15" height="22" rx="7" fill="#f22e35"/><ellipse cx="26" cy="17" rx="4" ry="6" fill="#ef2330"/><path d="M12 27h12v5H12Z" fill="#ddd"/>',
    shoes:
      '<path d="M12 8h14v14l5 2v6H6v-9h6Z" fill="#218bd0" stroke="#63777d"/><ellipse cx="19" cy="8" rx="8" ry="4" fill="#2a84d5" stroke="#ffb52a" stroke-width="3"/>',
    ghost:
      '<path d="M7 29l3-17q8-17 16 0l3 17-7-3-4 5-4-5Z" fill="#bbc2ca" stroke="#7e858c"/><ellipse cx="15" cy="15" rx="2" ry="3" fill="white"/><ellipse cx="22" cy="15" rx="2" ry="3" fill="white"/>',
    balloon:
      '<ellipse cx="18" cy="17" rx="9" ry="10" fill="#72d4ef" stroke="#397fa5"/><ellipse cx="15" cy="13" rx="3" ry="2" fill="#fff"/><path d="M16 27l2-3 2 3" fill="#72d4ef" stroke="#397fa5"/>',
    range:
      '<path d="M14 6h8v12l8 11q-12 9-24 0l8-11Z" fill="#29c9ff" stroke="#2472b5"/><ellipse cx="18" cy="6" rx="6" ry="3" fill="#ffaa30"/><path d="M14 19l-3 7 4 2" fill="none" stroke="#dcfaff" stroke-width="3"/>',
    power:
      '<path d="M17 14Q3 5 11 4q10 1 6 10M19 14Q20 0 29 4q2 8-10 10" fill="#abd77f" stroke="#699873"/><path d="M12 13l13 1-5 14-5 3-2-9Z" fill="#ffcf75" stroke="#bf9657"/><path d="M14 24l-5 4m10-4 7 4" stroke="#bf9657" fill="none"/>',
  };
  return `<svg viewBox="0 0 36 36" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="34" height="34" rx="10" fill="#fff8dc" stroke="#d8bc7b" stroke-width="1.5"/>${icons[kind]}</svg>`;
}
