/** Runtime matte only: keep uploaded files and the balloon's original RGB artwork. */
export function balloonCutout(image: HTMLImageElement, id: number) {
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const ctx = source.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const { width: w, height: h } = source;
  if (id === 13 || id === 14) {
    // These two screenshots share blue scenery with the balloon rim. A silhouette
    // clip avoids color-keying away the original blue highlights inside the art.
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    if (id === 14)
      ctx.ellipse(w * 0.49, h * 0.48, w * 0.46, h * 0.47, 0, 0, Math.PI * 2);
    else {
      const outline = [
        [0.07, 0.65],
        [0.07, 0.44],
        [0.14, 0.22],
        [0.22, 0.12],
        [0.19, 0.03],
        [0.32, 0.1],
        [0.41, 0.01],
        [0.54, 0.12],
        [0.6, 0.04],
        [0.68, 0.15],
        [0.81, 0.16],
        [0.8, 0.27],
        [0.91, 0.37],
        [0.94, 0.58],
        [0.86, 0.78],
        [0.68, 0.9],
        [0.45, 0.93],
        [0.23, 0.87],
        [0.12, 0.76],
      ];
      outline.forEach(([x, y], i) =>
        i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h),
      );
      ctx.closePath();
    }
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  } else {
    const pixels = ctx.getImageData(0, 0, w, h);
    const data = pixels.data;
    const background = (n: number) => {
      const r = data[n * 4],
        g = data[n * 4 + 1],
        b = data[n * 4 + 2];
      const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 28;
      if (id <= 2)
        return (
          (r > b * 1.2 && g > b * 1.1) ||
          (neutral && r < 170) ||
          (id === 2 && r < 60 && g < 100 && b < 50)
        );
      if (id === 3)
        return (
          Math.max(Math.abs(r - 11), Math.abs(g - 184), Math.abs(b - 247)) < 30
        );
      if (id <= 8)
        return neutral && ((r > 90 && r < 168) || (id === 6 && r > 230));
      return neutral && Math.min(r, g, b) > 220;
    };
    const seen = new Uint8Array(w * h),
      queue = new Int32Array(w * h);
    let head = 0,
      tail = 0;
    const visit = (n: number) => {
      if (seen[n]) return;
      seen[n] = 1;
      if (background(n)) queue[tail++] = n;
    };
    for (let x = 0; x < w; x++) {
      visit(x);
      visit((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      visit(y * w);
      visit(y * w + w - 1);
    }
    while (head < tail) {
      const n = queue[head++],
        x = n % w,
        y = Math.floor(n / w);
      data[n * 4 + 3] = 0;
      if (x) visit(n - 1);
      if (x < w - 1) visit(n + 1);
      if (y) visit(n - w);
      if (y < h - 1) visit(n + w);
    }
    ctx.putImageData(pixels, 0, 0);
  }
  // Trim screenshot margins without changing proportions, then fit the same slot.
  const pixels = ctx.getImageData(0, 0, w, h).data;
  let left = w,
    top = h,
    right = 0,
    bottom = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (pixels[(y * w + x) * 4 + 3] > 32) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
  const result = document.createElement("canvas");
  result.width = result.height = 96;
  const out = result.getContext("2d")!;
  out.imageSmoothingEnabled = false;
  const sw = right - left + 1,
    sh = bottom - top + 1,
    scale = Math.min(92 / sw, 92 / sh);
  out.drawImage(
    source,
    left,
    top,
    sw,
    sh,
    (96 - sw * scale) / 2,
    (96 - sh * scale) / 2,
    sw * scale,
    sh * scale,
  );
  return result;
}
