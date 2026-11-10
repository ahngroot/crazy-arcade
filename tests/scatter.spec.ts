import { test, expect } from "@playwright/test";
test("death items fly from the character to authoritative floor targets at enlarged size", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountArenaFixture } = await import(path);
    const root = document.createElement("div");
    root.id = "scatter-fixture";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:9999;background:#111";
    document.body.append(root);
    const f = mountArenaFixture(root, "pirate-lion");
    await f.ready;
    f.scatter();
    (window as any).scatterFixture = f;
  });
  const advance = (time: number) =>
    page.evaluate((time) => {
      (window as any).scatterFixture.state.time = time;
    }, time);
  const frames = () =>
    page.evaluate(
      () =>
        (window as any).scatterFixture.itemFrames() as {
          x: number;
          y: number;
          width: number;
          height: number;
          alpha: number;
        }[],
    );
  await expect.poll(async () => (await frames()).length).toBe(3);
  const from = await frames();
  expect(from[0].width).toBe(40.5);
  await advance(350);
  await page.waitForTimeout(80);
  const middle = await frames();
  expect(middle).not.toEqual(from);
  await page
    .locator("#scatter-fixture")
    .screenshot({ path: "test-results/scatter-flight.png" });
  await advance(1100);
  await page.waitForTimeout(80);
  const landed = await frames();
  const targets = await page.evaluate(() =>
    (window as any).scatterFixture.state.items.map((i: any) => ({
      x: (i.x + 0.5) * 40,
      y: (i.y + 0.5) * 40,
    })),
  );
  landed.forEach((f, n) => {
    expect(f.x).toBeCloseTo(targets[n].x, 4);
    expect(Math.abs(f.y - targets[n].y - 7)).toBeLessThan(2);
  });
  expect(
    middle.every((f, n) => {
      const progress = 350 / (700 + n * 45);
      return f.y < from[n].y * (1 - progress) + landed[n].y * progress - 40;
    }),
  ).toBe(true);
  await page
    .locator("#scatter-fixture")
    .screenshot({ path: "test-results/scatter-landed.png" });
  const expiry = await page.evaluate(
    () => (window as any).scatterFixture.state.items[0].expiresAt,
  );
  await advance(expiry - 1500);
  await expect.poll(async () => (await frames())[0].alpha).toBeCloseTo(0.5, 2);
  await advance(expiry);
  await expect.poll(async () => (await frames())[0].alpha).toBe(0);
  await page.evaluate(() => (window as any).scatterFixture.destroy());
});
