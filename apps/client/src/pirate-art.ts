import type Phaser from "phaser";
import type { Facing } from "@bubble/shared";
import walkUrl from "./assets/practice-pirate/walk.png";

// Four complete, drawn poses per direction. Never cut a boot into body halves.
const image = new Image();
image.src = walkUrl;
await image.decode();
export const PIRATE_WALK_FRAMES = 4;
export const PIRATE_WALK_FRAME_MS = 110;
const poses = (["down", "up", "left", "right"] as const).flatMap((dir, row) =>
  Array.from({ length: PIRATE_WALK_FRAMES }, (_, frame) => {
    const left = Math.round((frame * image.naturalWidth) / 4);
    const top = Math.round((row * image.naturalHeight) / 4);
    const crop = document.createElement("canvas");
    crop.width = Math.round(((frame + 1) * image.naturalWidth) / 4) - left;
    crop.height = Math.round(((row + 1) * image.naturalHeight) / 4) - top;
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
    const components: number[][] = [];
    for (let start = 0; start < seen.length; start++) {
      if (seen[start] || pixels.data[start * 4 + 3] < 32) continue;
      const part = [start];
      seen[start] = 1;
      for (let j = 0; j < part.length; j++) {
        const at = part[j],
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
            part.push(n);
          }
      }
      components.push(part);
    }
    components.sort((a, b) => b.length - a.length);
    if (!components.length) throw Error(`Empty pirate pose ${dir}/${frame}`);
    // Keep substantial secondary components too: a lifted boot is valid art,
    // unlike tiny disconnected generation specks around a sprite.
    const keep = new Uint8Array(seen.length);
    for (const part of components)
      if (
        part === components[0] ||
        part.length >= Math.max(32, components[0].length * 0.004)
      )
        for (const at of part) keep[at] = 1;
    let x = crop.width,
      y = crop.height,
      right = 0,
      bottom = 0;
    for (let at = 0; at < keep.length; at++) {
      if (!keep[at]) {
        pixels.data[at * 4 + 3] = 0;
        continue;
      }
      const px = at % crop.width,
        py = Math.floor(at / crop.width);
      x = Math.min(x, px);
      y = Math.min(y, py);
      right = Math.max(right, px + 1);
      bottom = Math.max(bottom, py + 1);
    }
    if (x < 2 || y < 2 || right > crop.width - 2 || bottom > crop.height - 2)
      throw Error(`Pirate pose touches sheet cell edge: ${dir}/${frame}`);
    c.putImageData(pixels, 0, 0);
    return { dir, frame, crop, x, y, w: right - x, h: bottom - y };
  }),
);
export const pirateTexture = (dir: Facing, frame?: number) =>
  `art-practice-pirate-${dir}${frame === undefined ? "" : `-walk-${frame % PIRATE_WALK_FRAMES}`}`;
export const pirateDisplaySize = { width: 0, height: 0 };
export function installPirateArt(scene: Phaser.Scene, height: number) {
  const maxWidth = Math.max(...poses.map((p) => (p.w / p.h) * 144));
  // Extra horizontal padding covers every stride, including the rear boot.
  const fitWidth = Math.min(1, 128 / maxWidth);
  for (const pose of poses) {
    const key = pirateTexture(pose.dir, pose.frame);
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = 144;
    canvas.height = 160;
    const c = canvas.getContext("2d")!;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    const width = (pose.w / pose.h) * 144 * fitWidth;
    c.drawImage(
      pose.crop,
      pose.x,
      pose.y,
      pose.w,
      pose.h,
      72 - width / 2,
      12,
      width,
      144,
    );
    scene.textures.addCanvas(key, canvas);
    if (pose.frame === 0 && !scene.textures.exists(pirateTexture(pose.dir)))
      scene.textures.addCanvas(pirateTexture(pose.dir), canvas);
  }
  pirateDisplaySize.height = (height * 160) / 144;
  pirateDisplaySize.width = Math.min(
    height,
    (38 * 144) / (maxWidth * fitWidth),
  );
}
