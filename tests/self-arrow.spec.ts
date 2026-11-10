import { test, expect } from "@playwright/test";

test("only the local character gets a head arrow, including after trapping and respawn", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountRendererFixture } = await import(path);
    const root = document.createElement("div");
    root.id = "arrow-fixture";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:9999;background:#111";
    document.body.append(root);
    const f = mountRendererFixture(root, "p2");
    await f.ready;
    f.state.players[0].characterId = 0;
    f.state.players[1].characterId = 5;
    (window as any).arrowFixture = f;
    (window as any).arrowSnapshot = JSON.stringify(f.state);
  });
  const arrow = () =>
    page.evaluate(
      () =>
        (window as any).arrowFixture.arrowFrames() as {
          x: number;
          y: number;
          visible: boolean;
        }[],
    );
  await expect.poll(async () => (await arrow()).length).toBe(1);
  await expect
    .poll(async () => (await arrow())[0])
    .toMatchObject({ x: 460, visible: true });
  expect((await arrow())[0].y).toBeLessThan(260);
  expect(
    await page.evaluate(
      () =>
        JSON.stringify((window as any).arrowFixture.state) ===
        (window as any).arrowSnapshot,
    ),
  ).toBe(true);
  await page
    .locator("#arrow-fixture")
    .screenshot({ path: "test-results/self-arrow.png" });
  await page.evaluate(() => {
    const f = (window as any).arrowFixture,
      p = f.state.players[1];
    p.status = "trapped";
    p.statusUntil = 5000;
    p.position = { x: 8.5, y: 1.5 };
  });
  await expect
    .poll(async () => (await arrow())[0])
    .toMatchObject({ x: 340, visible: true });
  expect((await arrow())[0].y).toBeGreaterThanOrEqual(10);
  await page.evaluate(() => {
    const f = (window as any).arrowFixture,
      p = f.state.players[1];
    p.status = "respawning";
    p.statusUntil = 1800;
  });
  await expect.poll(async () => (await arrow())[0].visible).toBe(false);
  await page.evaluate(() => {
    const p = (window as any).arrowFixture.state.players[1];
    p.status = "active";
    p.position = { x: 5.5, y: 8.5 };
  });
  await expect
    .poll(async () => (await arrow())[0])
    .toMatchObject({ x: 220, visible: true });
  await page.evaluate(() => (window as any).arrowFixture.destroy());
  await expect(page.locator("#arrow-fixture canvas")).toHaveCount(0);
});
