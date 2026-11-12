import type Phaser from "phaser";
import type { Facing } from "@bubble/shared";
import front from "./assets/practice-pirate/front.png";
import back from "./assets/practice-pirate/back.png";
import left from "./assets/practice-pirate/left.png";
import right from "./assets/practice-pirate/right.png";

// Original photographs stay untouched. These silhouette paths exclude scenery
// when creating game textures; no generated replacement character is used.
const sources = [
  {
    dir: "down",
    url: front,
    outline: [
      [30, 44],
      [49, 48],
      [60, 35],
      [72, 24],
      [91, 20],
      [112, 25],
      [127, 43],
      [144, 48],
      [156, 42],
      [164, 49],
      [159, 65],
      [146, 76],
      [150, 88],
      [157, 94],
      [157, 113],
      [143, 125],
      [139, 137],
      [144, 150],
      [137, 157],
      [139, 169],
      [119, 173],
      [103, 167],
      [86, 170],
      [65, 170],
      [61, 161],
      [58, 153],
      [54, 151],
      [53, 137],
      [58, 127],
      [44, 121],
      [40, 104],
      [43, 88],
      [48, 77],
      [35, 69],
      [29, 57],
    ],
  },
  {
    dir: "up",
    url: back,
    outline: [
      [15, 39],
      [27, 37],
      [37, 43],
      [46, 28],
      [58, 22],
      [80, 19],
      [97, 26],
      [108, 40],
      [116, 43],
      [125, 37],
      [130, 43],
      [127, 56],
      [117, 65],
      [114, 75],
      [122, 82],
      [123, 94],
      [113, 102],
      [104, 103],
      [99, 111],
      [106, 119],
      [104, 127],
      [99, 130],
      [106, 139],
      [105, 148],
      [88, 152],
      [76, 147],
      [60, 151],
      [43, 151],
      [40, 143],
      [43, 135],
      [39, 130],
      [34, 126],
      [39, 116],
      [48, 108],
      [43, 101],
      [29, 98],
      [22, 91],
      [22, 82],
      [29, 74],
      [33, 65],
      [23, 59],
      [17, 50],
    ],
  },
  {
    dir: "left",
    url: left,
    outline: [
      [18, 24],
      [24, 20],
      [33, 12],
      [39, 11],
      [45, 17],
      [48, 21],
      [64, 20],
      [78, 23],
      [85, 25],
      [88, 30],
      [104, 33],
      [114, 43],
      [126, 48],
      [129, 59],
      [123, 69],
      [127, 78],
      [128, 95],
      [120, 105],
      [104, 110],
      [98, 119],
      [99, 129],
      [106, 139],
      [104, 145],
      [95, 148],
      [95, 156],
      [76, 157],
      [69, 153],
      [48, 155],
      [34, 151],
      [34, 144],
      [42, 135],
      [43, 128],
      [40, 122],
      [44, 114],
      [50, 108],
      [51, 100],
      [43, 99],
      [35, 94],
      [28, 94],
      [24, 88],
      [18, 88],
      [16, 81],
      [23, 77],
      [26, 65],
      [25, 53],
      [20, 49],
      [18, 40],
      [10, 36],
      [11, 31],
      [20, 32],
    ],
  },
  {
    dir: "right",
    url: right,
    outline: [
      [26, 25],
      [29, 20],
      [40, 19],
      [48, 22],
      [58, 13],
      [69, 11],
      [81, 15],
      [88, 24],
      [91, 34],
      [87, 45],
      [90, 54],
      [85, 60],
      [78, 63],
      [83, 68],
      [81, 75],
      [73, 78],
      [73, 86],
      [79, 94],
      [77, 104],
      [64, 107],
      [52, 104],
      [42, 105],
      [32, 101],
      [32, 96],
      [38, 91],
      [38, 85],
      [34, 82],
      [36, 74],
      [33, 68],
      [22, 67],
      [17, 61],
      [16, 52],
      [20, 45],
      [14, 39],
      [16, 34],
      [23, 34],
    ],
  },
] as const;
const images = await Promise.all(
  sources.map(async (source) => {
    const image = new Image();
    image.src = source.url;
    await image.decode();
    return { ...source, image };
  }),
);
export const PIRATE_WALK_FRAMES = 16;
export const pirateTexture = (dir: Facing, frame?: number) =>
  `art-practice-pirate-${dir}${frame === undefined ? "" : `-walk-${frame % PIRATE_WALK_FRAMES}`}`;
export const pirateDisplaySize = { width: 0, height: 0 };
export function installPirateArt(scene: Phaser.Scene, height: number) {
  let maxWidth = 0;
  for (const source of images) {
    const key = pirateTexture(source.dir);
    const xs = source.outline.map((p) => p[0]),
      ys = source.outline.map((p) => p[1]);
    const x = Math.min(...xs),
      y = Math.min(...ys);
    const w = Math.max(...xs) - x,
      h = Math.max(...ys) - y;
    maxWidth = Math.max(maxWidth, (w / h) * 144);
    if (scene.textures.exists(key)) continue;
    const crop = document.createElement("canvas");
    crop.width = source.image.naturalWidth;
    crop.height = source.image.naturalHeight;
    const c = crop.getContext("2d")!;
    c.beginPath();
    source.outline.forEach(([px, py], i) =>
      i ? c.lineTo(px, py) : c.moveTo(px, py),
    );
    c.closePath();
    c.clip();
    c.drawImage(source.image, 0, 0);
    // The character is grey/black/white with orange skin. The saturated blue
    // containers and yellow crate/flag fragments belong to the photo scenery.
    // Drop those spill pixels before scaling; preserve remaining source RGB.
    const pixels = c.getImageData(0, 0, crop.width, crop.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const [r, g, b] = pixels.data.subarray(i, i + 3);
      const blueScenery = b > 85 && b > r + 32 && b > g + 16 && g > r + 12;
      const yellowScenery =
        r > 120 &&
        g > 95 &&
        g > b * 1.38 &&
        r >= g - 5 &&
        r - g < (g - b) * 0.65;
      if (blueScenery || yellowScenery) pixels.data[i + 3] = 0;
    }
    // Keep only the connected character silhouette, excluding isolated scraps.
    const seen = new Uint8Array(crop.width * crop.height);
    let largest: number[] = [];
    for (let start = 0; start < seen.length; start++) {
      if (seen[start] || pixels.data[start * 4 + 3] < 16) continue;
      const component = [start];
      seen[start] = 1;
      for (let j = 0; j < component.length; j++) {
        const at = component[j],
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
              pixels.data[n * 4 + 3] < 16
            )
              continue;
            seen[n] = 1;
            component.push(n);
          }
      }
      if (component.length > largest.length) largest = component;
    }
    const keep = new Uint8Array(seen.length);
    for (const at of largest) keep[at] = 1;
    for (let at = 0; at < keep.length; at++)
      if (!keep[at]) pixels.data[at * 4 + 3] = 0;
    c.putImageData(pixels, 0, 0);
    const canvas = document.createElement("canvas");
    canvas.width = 144;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(crop, x, y, w, h, 72 - (w / h) * 72, 12, (w / h) * 144, 144);
    scene.textures.addCanvas(key, canvas);
    // Animate the photographed pixels, keeping the face/hat unpainted and
    // unchanged. Two leg regions swing alternately, blending into the torso.
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
