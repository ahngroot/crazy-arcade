import { test, expect } from "@playwright/test";

test("a character blocked by walls keeps walking and facing the held direction until release", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts",
      sharedPath = "/@fs/workspace/crazy-arcade/packages/shared/src/index.ts";
    const { mountRendererFixture } = await import(path);
    const { movePlayer, EMPTY_INPUT } = await import(sharedPath);
    const root = document.createElement("div");
    root.id = "blocked-fixture";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:9999;background:#111";
    document.body.append(root);
    const f = mountRendererFixture(root);
    await f.ready;
    f.state.arenaId = "pirate-lion";
    f.state.map.forEach((row: any[]) => row.fill("floor"));
    f.state.map[4][3] =
      f.state.map[4][5] =
      f.state.map[3][4] =
      f.state.map[5][4] =
        "wall";
    f.state.mapRevision++;
    f.state.players = [f.state.players[0]];
    f.state.players[0].characterId = 0;
    f.state.players[0].position = { x: 4.5, y: 4.5 };
    (window as any).blocked = { f, movePlayer, EMPTY_INPUT };
  });
  const key = () =>
    page.evaluate(
      () => (window as any).blocked.f.actorFrames()[0].key as string,
    );
  for (const [x, y, dir] of [
    [1, 0, "right"],
    [-1, 0, "left"],
    [0, -1, "up"],
    [0, 1, "down"],
  ] as const) {
    const p = await page.evaluate(
      ({ x, y }) => {
        const { f, movePlayer, EMPTY_INPUT } = (window as any).blocked;
        for (let n = 0; n < 60; n++)
          movePlayer(f.state, f.state.players[0], { ...EMPTY_INPUT, x, y }, 16);
        return f.state.players[0];
      },
      { x, y },
    );
    expect(p.position).toEqual({ x: 4.5, y: 4.5 });
    expect(p.moving).toBe(true);
    expect(p.facing).toBe(dir);
    const prefix =
      dir === "down" ? "art-character-0-0-" : `art-direction-0-${dir}-`;
    await expect.poll(key).toMatch(new RegExp(`^${prefix}`));
    const keys = new Set<string>();
    for (let n = 0; n < 10; n++) {
      keys.add(await key());
      await page.waitForTimeout(75);
    }
    expect(keys.size).toBeGreaterThanOrEqual(3);
    await page.evaluate(() => {
      const { f, movePlayer, EMPTY_INPUT } = (window as any).blocked;
      movePlayer(f.state, f.state.players[0], EMPTY_INPUT, 16);
    });
    await expect.poll(key).toBe(prefix + "0");
  }
  await page
    .locator("#blocked-fixture")
    .screenshot({ path: "test-results/blocked-walking.png" });
  await page.evaluate(() => (window as any).blocked.f.destroy());
});
