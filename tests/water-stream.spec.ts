import { test, expect } from "@playwright/test";
test("reference water joins all four arms, rotates end caps and clears after the blast", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountRendererFixture } = await import(path);
    const root = document.createElement("div");
    root.id = "water-fixture";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:9999;background:#111";
    document.body.append(root);
    const f = mountRendererFixture(root);
    await f.ready;
    const cells = [{ x: 7, y: 6 }];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      for (let n = 1; n <= 2; n++) cells.push({ x: 7 + dx * n, y: 6 + dy * n });
    cells.forEach((c) => (f.state.map[c.y][c.x] = "floor"));
    f.state.mapRevision++;
    f.state.blasts = [{ id: 999, owner: "p1", cells, expiresAt: 500 }];
    (window as any).waterFixture = f;
  });
  const frames = () =>
    page.evaluate(
      () =>
        (window as any).waterFixture.waterFrames() as {
          key: string;
          angle: number;
        }[],
    );
  await expect.poll(async () => (await frames()).length).toBe(9);
  const visible = await frames();
  expect(visible.filter((f) => f.key === "art-stream-center")).toHaveLength(1);
  expect(visible.filter((f) => f.key === "art-stream-body")).toHaveLength(4);
  expect(
    visible
      .filter((f) => f.key === "art-stream-cap")
      .map((f) => f.angle)
      .sort((a, b) => a - b),
  ).toEqual([-180, -90, 0, 90]);
  await page
    .locator("#water-fixture")
    .screenshot({ path: "test-results/reference-water.png" });
  await page.evaluate(() => ((window as any).waterFixture.state.blasts = []));
  await expect.poll(async () => (await frames()).length).toBe(0);
  await page.evaluate(() => (window as any).waterFixture.destroy());
});
