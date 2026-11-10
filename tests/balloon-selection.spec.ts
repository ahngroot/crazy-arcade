import { test, expect } from "./fixtures";

test("15 balloon pictures can be chosen without names and selection survives reload and solo restart", async ({
  page,
}) => {
  await page.goto("/");
  const picker = page.getByRole("radiogroup", {
    name: "물풍선 선택",
    exact: true,
  });
  await expect(picker.getByRole("radio")).toHaveCount(15);
  await expect(picker.getByRole("radio").filter({ hasText: /\S/ })).toHaveCount(
    0,
  );
  await page.locator('[data-balloon-skin="6"]').click();
  await page.reload();
  await expect(page.locator('[data-balloon-skin="6"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.locator('[data-balloon-skin="6"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-balloon-skin="7"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect
    .poll(() =>
      picker
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (i) =>
              (i as HTMLImageElement).complete &&
              (i as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page
    .locator(".balloon-picker")
    .screenshot({ path: "test-results/balloon-selection.png" });
  await page.locator("#practice").click();
  await expect(page.locator('[data-player="p1"]')).toHaveAttribute(
    "data-balloon-skin",
    "7",
  );
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-start-phase",
    "playing",
    { timeout: 10000 },
  );
  await page
    .getByRole("button", { name: "처음부터 다시", exact: true })
    .click();
  await expect(page.locator('[data-player="p1"]')).toHaveAttribute(
    "data-balloon-skin",
    "7",
  );
});

test("online peers keep different balloon choices", async ({ page, duel }) => {
  await page.goto("/");
  await page.locator('[data-balloon-skin="13"]').click();
  await duel(page, { guest: true, navigate: false, opponentBalloonSkinId: 4 });
  await expect(page.locator('[data-player="p1"]')).toHaveAttribute(
    "data-balloon-skin",
    "4",
  );
  await expect(page.locator('[data-player="p2"]')).toHaveAttribute(
    "data-balloon-skin",
    "13",
  );
  await page.keyboard.press("Space");
  await expect(
    page.locator('[data-player="p2"] [data-stat="balloon"]'),
  ).toHaveText("1 / 1");
});

test("all 15 polished balloon textures render intact with clear corners and unchanged state", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const fixturePath = "/src/showcase.ts";
    const { mountRendererFixture } = (await import(
      fixturePath
    )) as typeof import("../apps/client/src/showcase");
    const root = document.createElement("div");
    root.id = "balloon-gallery";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;background:#d7e5c8;z-index:99999";
    document.body.append(root);
    const f = mountRendererFixture(root);
    await f.ready;
    f.state.map = f.state.map.map((row: any[]) => row.map(() => "floor"));
    f.state.mapRevision++;
    f.state.players = [];
    f.state.items = [];
    f.state.round = undefined;
    f.state.balloons = Array.from({ length: 15 }, (_, id) => ({
      id: id + 100,
      skinId: id,
      owner: "p1",
      x: 2 + (id % 5) * 2,
      y: 3 + Math.floor(id / 5) * 3,
      range: 1,
      explodesAt: 2500,
      passThrough: [],
    }));
    (window as any).balloonGallery = f;
    (window as any).balloonSnapshot = JSON.stringify(f.state);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).balloonGallery.balloonFrames().length,
      ),
    )
    .toBe(15);
  const keys = await page.evaluate(() =>
    (window as any).balloonGallery
      .balloonFrames()
      .map((f: any) => f.key.replace(/-flow-\d+$/, ""))
      .sort(),
  );
  expect(keys).toEqual(
    [
      "art-balloon",
      ...Array.from({ length: 14 }, (_, i) => `art-balloon-skin-${i + 1}`),
    ].sort(),
  );
  const pixels = await page.evaluate(async () => {
    const skinPath = "/src/balloon-skins.ts";
    const { balloonSkins } = (await import(
      skinPath
    )) as typeof import("../apps/client/src/balloon-skins");
    return balloonSkins.map((s) => {
      const c = s.image as HTMLCanvasElement;
      const p = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let left = c.width,
        right = 0;
      for (let y = 92; y < 100; y++)
        for (let x = 0; x < c.width; x++)
          if (p[(y * c.width + x) * 4 + 3] > 128) {
            left = Math.min(left, x);
            right = Math.max(right, x);
          }
      return {
        id: s.id,
        bodyWidth: right - left + 1,
        corner: p[3],
        opaque: Array.from(p).filter((_, i) => i % 4 === 3 && p[i] > 128)
          .length,
      };
    });
  });
  expect(pixels.every((p) => p.corner === 0 && p.opaque > 1500)).toBe(true);
  const pinkWidth = pixels.find((p) => p.id === 11)!.bodyWidth;
  for (const skin of pixels)
    expect(
      Math.abs(skin.bodyWidth - pinkWidth),
      `body width for ${skin.id}`,
    ).toBeLessThanOrEqual(2);
  await page.evaluate(() => (window as any).balloonGallery.capture());
  await page.waitForTimeout(200);
  const screenshot = await page
    .locator("#balloon-gallery")
    .screenshot({ path: "test-results/balloon-all-placed.png" });
  const coverage = await page.evaluate(async (encoded) => {
    const f = (window as any).balloonGallery;
    const read = async (url: string) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      };
    };
    const screen = await read(`data:image/png;base64,${encoded}`);
    const result = [];
    for (const frame of f.balloonFrames()) {
      const texture = await read(f.balloonTextureUrl(frame.key));
      let samples = 0,
        matched = 0;
      const rad = (frame.angle * Math.PI) / 180;
      for (let sy = 8; sy < texture.height - 8; sy += 4)
        for (let sx = 8; sx < texture.width - 8; sx += 4) {
          const i = (sy * texture.width + sx) * 4;
          if (
            texture.data[i + 3] < 250 ||
            texture.data[i - 4 + 3] < 250 ||
            texture.data[i + 4 + 3] < 250
          )
            continue;
          const dx = ((sx + 0.5) / texture.width - 0.5) * frame.width,
            dy = ((sy + 0.5) / texture.height - frame.originY) * frame.height;
          const x = Math.floor(
              frame.x + Math.cos(rad) * dx - Math.sin(rad) * dy,
            ),
            y = Math.floor(frame.y + Math.sin(rad) * dx + Math.cos(rad) * dy);
          const at = (y * screen.width + x) * 4;
          samples++;
          if (
            [0, 1, 2].every(
              (c) => Math.abs(texture.data[i + c] - screen.data[at + c]) < 65,
            )
          )
            matched++;
        }
      result.push({ key: frame.key, coverage: matched / Math.max(1, samples) });
    }
    return result;
  }, screenshot.toString("base64"));
  for (const result of coverage)
    expect(result.coverage, result.key).toBeGreaterThan(0.85);
  expect(
    await page.evaluate(
      () =>
        JSON.stringify((window as any).balloonGallery.state) ===
        (window as any).balloonSnapshot,
    ),
  ).toBe(true);
  await page.evaluate(() => (window as any).balloonGallery.destroy());
});
