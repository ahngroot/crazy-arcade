import { test, expect } from "@playwright/test";

test("both trap appearances stay stable, whiten with matching art and survive drowning", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountRendererFixture } = await import(path);
    const root = document.createElement("div");
    root.id = "trap-variants-fixture";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:9999;background:#111";
    document.body.append(root);
    const f = mountRendererFixture(root);
    await f.ready;
    f.state.players = [f.state.players[0]];
    f.state.players[0].characterId = 0;
    (window as any).variants = f;
  });
  const frames = () =>
    page.evaluate(
      () =>
        (window as any).variants.actorFrames() as {
          key: string;
          visible: boolean;
          alpha: number;
        }[],
    );
  const observed = new Set<string>();
  for (let n = 0; n < 20; n++) {
    await page.evaluate((n) => {
      const f = (window as any).variants;
      f.state.time = 100;
      f.state.players[0].status = "trapped";
      f.state.players[0].statusUntil = 5100 + n * 17;
      (window as any).trapSnapshot = JSON.stringify(f.state);
    }, n);
    await page.waitForTimeout(55);
    const key = (await frames()).find(
      (f) =>
        f.visible &&
        f.key.startsWith("art-trapped") &&
        !f.key.includes("white"),
    )!.key;
    observed.add(key);
    await page.waitForTimeout(55);
    expect((await frames()).some((f) => f.visible && f.key === key)).toBe(true);
    expect(
      await page.evaluate(
        () =>
          JSON.stringify((window as any).variants.state) ===
          (window as any).trapSnapshot,
      ),
    ).toBe(true);
    await page
      .locator("#trap-variants-fixture")
      .screenshot({ path: `test-results/${key}.png` });
    await page.evaluate(() => {
      const f = (window as any).variants;
      f.state.time = f.state.players[0].statusUntil - 10;
    });
    const white =
      key === "art-trapped-alt" ? "art-trapped-white-alt" : "art-trapped-white";
    await expect
      .poll(async () =>
        (await frames()).some(
          (f) => f.visible && f.key === white && f.alpha > 0.9,
        ),
      )
      .toBe(true);
    await page.evaluate(() => {
      const f = (window as any).variants;
      f.state.players[0].status = "respawning";
      f.state.players[0].statusUntil = f.state.time + 1800;
      f.state.time += 300;
    });
    await expect
      .poll(async () =>
        (await frames()).some(
          (f) => f.visible && f.key === white && f.alpha === 1,
        ),
      )
      .toBe(true);
    await page.evaluate(() => {
      const f = (window as any).variants;
      f.state.time += 400;
    });
    await expect
      .poll(async () =>
        (await frames()).some((f) => f.visible && f.key === "art-prone-0"),
      )
      .toBe(true);
    await page.evaluate(
      () => ((window as any).variants.state.players[0].status = "active"),
    );
    await expect
      .poll(
        async () =>
          (await frames()).filter(
            (f) => f.visible && f.key.startsWith("art-trapped"),
          ).length,
      )
      .toBe(0);
    if (observed.size === 2) break;
  }
  expect([...observed].sort()).toEqual(["art-trapped", "art-trapped-alt"]);
  await page.evaluate(() => (window as any).variants.destroy());
  await expect(page.locator("#trap-variants-fixture canvas")).toHaveCount(0);
});
