import { test, expect } from "@playwright/test";

test("all thirteen characters turn side/back, animate feet and retain their direction when stopped", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountRendererFixture } = await import(path);
    const root = document.createElement("div");
    root.id = "all-walks-fixture";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:9999;background:#111";
    document.body.append(root);
    const f = mountRendererFixture(root);
    await f.ready;
    const template = f.state.players[0];
    f.state.players = Array.from({ length: 13 }, (_, id) => ({
      ...template,
      id: `sprite-${id}`,
      characterId: id,
      moving: true,
      facing: "right",
      position: { x: 1.5 + (id % 4) * 4, y: 2.5 + Math.floor(id / 4) * 2.5 },
    }));
    f.state.map.forEach((row: any[]) => row.fill("floor"));
    f.state.mapRevision++;
    f.state.items = [];
    f.state.round!.monsters = [];
    (window as any).walks = f;
  });
  const frames = () =>
    page.evaluate(
      () =>
        (window as any).walks.actorFrames() as {
          key: string;
          visible: boolean;
        }[],
    );
  // Check actual rendered textures, including non-empty art and distinct foot pixels.
  const textures = await page.evaluate(
    () =>
      (window as any).walks.characterTextureInfo() as {
        key: string;
        visible: number;
        footHash: number;
      }[],
  );
  for (let id = 0; id < 13; id++)
    for (const dir of ["right", "left", "up", "down"]) {
      const prefix =
        dir === "down"
          ? `art-character-${id}-0-`
          : `art-direction-${id}-${dir}-`;
      const cycle = textures.filter((t) => t.key.startsWith(prefix));
      expect(cycle, `${id}/${dir} has all four frames`).toHaveLength(4);
      expect(cycle.every((t) => t.visible > 300)).toBe(true);
      expect(
        new Set(cycle.map((t) => t.footHash)).size,
        `${id}/${dir} moves feet`,
      ).toBeGreaterThanOrEqual(3);
    }
  for (const dir of ["right", "left", "up", "down"]) {
    await page.evaluate((dir) => {
      const f = (window as any).walks;
      f.state.players.forEach((p: any) => {
        p.facing = dir;
        p.moving = true;
      });
      (window as any).walkState = JSON.stringify(f.state);
    }, dir);
    await expect
      .poll(async () => {
        const keys = (await frames()).map((f) => f.key);
        return Array.from({ length: 13 }, (_, id) =>
          keys.some((k) =>
            k.startsWith(
              dir === "down"
                ? `art-character-${id}-0-`
                : `art-direction-${id}-${dir}-`,
            ),
          ),
        ).every(Boolean);
      })
      .toBe(true);
    const samples = Array.from({ length: 13 }, () => new Set<string>());
    for (let n = 0; n < 10; n++) {
      const keys = (await frames()).map((f) => f.key);
      for (let id = 0; id < 13; id++)
        samples[id].add(
          keys.find((k) =>
            k.startsWith(
              dir === "down"
                ? `art-character-${id}-0-`
                : `art-direction-${id}-${dir}-`,
            ),
          )!,
        );
      await page.waitForTimeout(75);
    }
    expect(samples.every((s) => s.size >= 3)).toBe(true);
    expect(
      await page.evaluate(
        () =>
          JSON.stringify((window as any).walks.state) ===
          (window as any).walkState,
      ),
    ).toBe(true);
    await page.evaluate(() =>
      (window as any).walks.state.players.forEach(
        (p: any) => (p.moving = false),
      ),
    );
    await expect
      .poll(async () => (await frames()).every((f) => f.key.endsWith("-0")))
      .toBe(true);
    await page.waitForTimeout(220);
    expect((await frames()).every((f) => f.key.endsWith("-0"))).toBe(true);
    await page
      .locator("#all-walks-fixture")
      .screenshot({ path: `test-results/all-characters-${dir}.png` });
  }
  await page.evaluate(() => (window as any).walks.destroy());
  await expect(page.locator("#all-walks-fixture canvas")).toHaveCount(0);
});
