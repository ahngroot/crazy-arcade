import { test, expect } from "@playwright/test";
type Gallery = ReturnType<
  typeof import("../apps/client/src/showcase").mountArtGallery
>;
type Fixture = ReturnType<
  typeof import("../apps/client/src/showcase").mountRendererFixture
>;
type VisualWindow = Window & { gallery: Gallery; fixture: Fixture };

test("original art frames render together and missing textures have a visible fallback", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const count = await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountArtGallery } = (await import(
      path
    )) as typeof import("../apps/client/src/showcase");
    const root = document.createElement("div");
    root.id = "art-gallery";
    root.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:#f4f5e9;width:840px;height:720px;";
    document.body.append(root);
    const gallery = mountArtGallery(root);
    (window as unknown as VisualWindow).gallery = gallery;
    await gallery.ready;
    return gallery.textureCount();
  });
  expect(count).toBeGreaterThanOrEqual(220);
  await page
    .locator("#art-gallery")
    .screenshot({ path: "test-results/original-art-gallery.png" });
  await page.evaluate(() =>
    (window as unknown as VisualWindow).gallery.removeWalkingFrames(),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as VisualWindow).gallery.fallbackVisible(),
      ),
    )
    .toBe(true);
  await page.evaluate(() =>
    (window as unknown as VisualWindow).gallery.destroy(),
  );
  expect(errors).toEqual([]);
});

test("traps, golden effects, victory expressions and particle bounds render without changing game state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountRendererFixture } = (await import(
      path
    )) as typeof import("../apps/client/src/showcase");
    const root = document.createElement("div");
    root.id = "render-fixture";
    root.style.cssText =
      "position:fixed;top:0;left:0;width:600px;height:520px;z-index:9999;background:#caf0d7;";
    document.body.append(root);
    const fixture = mountRendererFixture(root);
    (window as unknown as VisualWindow).fixture = fixture;
    await fixture.ready;
  });
  await page.evaluate(() => {
    const f = (window as unknown as VisualWindow).fixture;
    f.trapped();
    f.capture();
  });
  await page
    .locator("#render-fixture")
    .screenshot({ path: "test-results/visual-trap.png" });
  await page.evaluate(() => {
    const f = (window as unknown as VisualWindow).fixture;
    f.golden();
    f.capture();
  });
  await page
    .locator("#render-fixture")
    .screenshot({ path: "test-results/visual-golden.png" });
  await page.evaluate(() => {
    const f = (window as unknown as VisualWindow).fixture;
    f.finish();
    f.capture();
  });
  await page
    .locator("#render-fixture")
    .screenshot({ path: "test-results/visual-victory.png" });
  const original = await page.evaluate(() =>
    JSON.stringify((window as unknown as VisualWindow).fixture.state),
  );
  await page.waitForTimeout(180);
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as unknown as VisualWindow).fixture.state),
    ),
  ).toBe(original);
  await page.evaluate(() => {
    const f = (window as unknown as VisualWindow).fixture;
    f.crowd();
    f.capture();
  });
  await expect
    .poll(async () =>
      Number(
        await page
          .locator("#render-fixture")
          .getAttribute("data-presentation-particles"),
      ),
    )
    .toBeGreaterThan(0);
  expect(
    Number(
      await page
        .locator("#render-fixture")
        .getAttribute("data-presentation-particles"),
    ),
  ).toBeLessThanOrEqual(220);
  await page.evaluate(() =>
    (window as unknown as VisualWindow).fixture.destroy(),
  );
  expect(errors).toEqual([]);
});
