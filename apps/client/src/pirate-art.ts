import type Phaser from "phaser";
import type { Facing } from "@bubble/shared";
import volumeUrl from "./assets/practice-pirate/volume.png";

// The user's photographs remain in assets/practice-pirate for reference.
// This edited 2x2 sheet adds dimensional lighting; it is not a live 3D model.
const image = new Image();
image.src = volumeUrl;
await image.decode();
const views = (["down", "up", "left", "right"] as const).map((dir, index) => {
  const col = index % 2,
    row = Math.floor(index / 2);
  const left = Math.round((col * image.naturalWidth) / 2);
  const top = Math.round((row * image.naturalHeight) / 2);
  const crop = document.createElement("canvas");
  crop.width = Math.round(((col + 1) * image.naturalWidth) / 2) - left;
  crop.height = Math.round(((row + 1) * image.naturalHeight) / 2) - top;
  const c = crop.getContext("2d")!;
  c.drawImage(
    image,
    left,
    top,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );
  const pixels = c.getImageData(0, 0, crop.width, crop.height);
  const seen = new Uint8Array(crop.width * crop.height);
  let largest: number[] = [];
  // Ignore detached generation specks. Retain the character's connected alpha.
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || pixels.data[start * 4 + 3] < 32) continue;
    const component = [start];
    seen[start] = 1;
    for (let i = 0; i < component.length; i++) {
      const at = component[i],
        x = at % crop.width,
        y = Math.floor(at / crop.width);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy,
            n = ny * crop.width + nx;
          if (
            nx < 0 ||
            nx >= crop.width ||
            ny < 0 ||
            ny >= crop.height ||
            seen[n] ||
            pixels.data[n * 4 + 3] < 32
          )
            continue;
          seen[n] = 1;
          component.push(n);
        }
    }
    if (component.length > largest.length) largest = component;
  }
  if (!largest.length) throw Error(`Empty pirate sprite: ${dir}`);
  const keep = new Uint8Array(seen.length);
  let x = crop.width,
    y = crop.height,
    right = 0,
    bottom = 0;
  for (const at of largest) {
    keep[at] = 1;
    const px = at % crop.width,
      py = Math.floor(at / crop.width);
    x = Math.min(x, px);
    y = Math.min(y, py);
    right = Math.max(right, px + 1);
    bottom = Math.max(bottom, py + 1);
  }
  for (let at = 0; at < keep.length; at++)
    if (!keep[at]) pixels.data[at * 4 + 3] = 0;
  c.putImageData(pixels, 0, 0);
  return { dir, crop, x, y, w: right - x, h: bottom - y };
});
export const PIRATE_WALK_FRAMES = 16;
export const pirateTexture = (dir: Facing, frame?: number) =>
  `art-practice-pirate-${dir}${frame === undefined ? "" : `-walk-${frame % PIRATE_WALK_FRAMES}`}`;
export const pirateDisplaySize = { width: 0, height: 0 };
export function installPirateArt(scene: Phaser.Scene, height: number) {
  let maxWidth = 0;
  for (const source of views) {
    const { crop, x, y, w, h } = source;
    maxWidth = Math.max(maxWidth, (w / h) * 144);
    const key = pirateTexture(source.dir);
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = 144;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(crop, x, y, w, h, 72 - (w / h) * 72, 12, (w / h) * 144, 144);
    scene.textures.addCanvas(key, canvas);
    // Animate the shaded sprite pixels without repainting the face or hat. Two leg regions swing alternately, blending into the torso.
    // One foot remains planted while the other lifts. No shared positions or
    // collision bounds change as part of this presentation-only walk cycle.
    for (let frame = 0; frame < PIRATE_WALK_FRAMES; frame++) {
      const walk = document.createElement("canvas");
      walk.width = 144;
      walk.height = 160;
      const c = walk.getContext("2d")!;
      c.imageSmoothingEnabled = true;
      const phase = Math.sin((frame / PIRATE_WALK_FRAMES) * Math.PI * 2);
      const bodyLift = -Math.abs(phase) * 1.2;
      c.drawImage(canvas, 0, 0, 144, 112, 0, bodyLift, 144, 112);
      for (let sy = 112; sy < 156; sy++) {
        const weight = Math.pow((sy - 112) / 44, 2);
        for (const side of [-1, 1]) {
          const lift = Math.max(0, phase * side) * 6;
          const stride =
            source.dir === "left" || source.dir === "right" ? 8 : 4;
          const dx = side * phase * stride * weight;
          const dy = bodyLift * (1 - weight) - lift * weight;
          const sx = side < 0 ? 0 : 72;
          c.drawImage(canvas, sx, sy, 72, 1, sx + dx, sy + dy, 72, 1.5);
        }
      }
      scene.textures.addCanvas(pirateTexture(source.dir, frame), walk);
    }
  }
  pirateDisplaySize.height = (height * 160) / 144;
  pirateDisplaySize.width = Math.min(height, (38 * 144) / maxWidth);
}
