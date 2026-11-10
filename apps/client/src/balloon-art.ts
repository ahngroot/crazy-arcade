import aUrl from "./assets/balloon-polished/a.png";
import bUrl from "./assets/balloon-polished/b.png";
import cUrl from "./assets/balloon-polished/c.png";
import dUrl from "./assets/balloon-polished/d.png";

// Align the spherical body, not the knot/flame/dolphin, to the former pink size.
export const BALLOON_ART = {
  width: 144,
  height: 160,
  bodyDiameter: 96,
  opticalDiameter: 94,
  centerX: 72,
  centerY: 96,
  displayWidth: (((40.7 * 92) / 96) * 144) / 94,
  displayHeight: (((42.9 * 92) / 96) * 160) / 94,
} as const;
const atlases = await Promise.all(
  [aUrl, bUrl, cUrl, dUrl].map(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  }),
);
// Full-atlas pixel rectangles of the round body, excluding external decorations.
const entries: {
  id: number;
  sheet: number;
  cell: number;
  body: [number, number, number, number];
}[] = [
  { id: 1, sheet: 0, cell: 0, body: [92, 134, 460, 458] },
  { id: 2, sheet: 0, cell: 1, body: [681, 134, 476, 458] },
  { id: 3, sheet: 0, cell: 2, body: [87, 719, 468, 464] },
  { id: 4, sheet: 0, cell: 3, body: [681, 719, 486, 464] },
  { id: 5, sheet: 1, cell: 0, body: [99, 125, 466, 457] },
  { id: 6, sheet: 1, cell: 1, body: [702, 142, 440, 439] },
  { id: 7, sheet: 1, cell: 2, body: [102, 717, 463, 447] },
  { id: 8, sheet: 1, cell: 3, body: [701, 723, 447, 441] },
  { id: 9, sheet: 2, cell: 0, body: [140, 165, 418, 410] },
  { id: 10, sheet: 2, cell: 1, body: [691, 155, 416, 416] },
  { id: 11, sheet: 2, cell: 2, body: [135, 714, 429, 431] },
  { id: 12, sheet: 2, cell: 3, body: [685, 716, 434, 428] },
  { id: 13, sheet: 3, cell: 0, body: [149, 192, 370, 370] },
  { id: 14, sheet: 3, cell: 1, body: [734, 148, 411, 416] },
  { id: 0, sheet: 3, cell: 2, body: [108, 749, 420, 431] },
];

function cleanCell(image: HTMLImageElement, cell: number) {
  const w = Math.floor(image.naturalWidth / 2),
    h = Math.floor(image.naturalHeight / 2);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    ((cell % 2) * image.naturalWidth) / 2,
    (Math.floor(cell / 2) * image.naturalHeight) / 2,
    w,
    h,
    0,
    0,
    w,
    h,
  );
  const pixels = ctx.getImageData(0, 0, w, h),
    data = pixels.data;
  // Keep the connected sprite and soft contour, discard isolated matte specks.
  const labels = new Int32Array(w * h),
    queue = new Int32Array(w * h);
  let label = 0,
    largest = 0,
    largestSize = 0;
  for (let seed = 0; seed < labels.length; seed++) {
    if (labels[seed] || data[seed * 4 + 3] < 48) continue;
    label++;
    let head = 0,
      tail = 1;
    queue[0] = seed;
    labels[seed] = label;
    const add = (n: number) => {
      if (!labels[n] && data[n * 4 + 3] >= 48) {
        labels[n] = label;
        queue[tail++] = n;
      }
    };
    while (head < tail) {
      const n = queue[head++],
        x = n % w;
      if (x) add(n - 1);
      if (x < w - 1) add(n + 1);
      if (n >= w) add(n - w);
      if (n < w * (h - 1)) add(n + w);
    }
    if (tail > largestSize) {
      largestSize = tail;
      largest = label;
    }
  }
  for (let n = 0; n < labels.length; n++) {
    if (labels[n] === largest) continue;
    const x = n % w,
      y = Math.floor(n / w);
    let near = false;
    if (data[n * 4 + 3] < 48)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (
            x + dx >= 0 &&
            x + dx < w &&
            y + dy >= 0 &&
            y + dy < h &&
            labels[n + dy * w + dx] === largest
          )
            near = true;
        }
    if (!near) data[n * 4 + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export const polishedBalloonArt = new Map(
  entries.map(({ id, sheet, cell, body }) => {
    const image = atlases[sheet],
      source = cleanCell(image, cell);
    const [x, y, w, h] = body;
    const cx = x + w / 2 - ((cell % 2) * image.naturalWidth) / 2;
    const cy = y + h / 2 - (Math.floor(cell / 2) * image.naturalHeight) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = BALLOON_ART.width;
    canvas.height = BALLOON_ART.height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const sx = BALLOON_ART.bodyDiameter / w,
      sy = BALLOON_ART.bodyDiameter / h;
    ctx.drawImage(
      source,
      BALLOON_ART.centerX - cx * sx,
      BALLOON_ART.centerY - cy * sy,
      source.width * sx,
      source.height * sy,
    );
    // Optical center-band alignment also accounts for dark flame/rim thickness.
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width,
      right = 0;
    for (let y = BALLOON_ART.centerY - 4; y < BALLOON_ART.centerY + 4; y++)
      for (let x = 0; x < canvas.width; x++)
        if (pixels[(y * canvas.width + x) * 4 + 3] > 128) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
    const opticalScale = BALLOON_ART.opticalDiameter / (right - left + 1);
    const aligned = document.createElement("canvas");
    aligned.width = canvas.width;
    aligned.height = canvas.height;
    const out = aligned.getContext("2d")!;
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = "high";
    out.drawImage(
      canvas,
      BALLOON_ART.centerX * (1 - opticalScale),
      BALLOON_ART.centerY * (1 - opticalScale),
      canvas.width * opticalScale,
      canvas.height * opticalScale,
    );
    return [id, aligned] as const;
  }),
);
