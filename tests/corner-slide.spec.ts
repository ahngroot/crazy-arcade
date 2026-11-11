import { test, expect } from "@playwright/test";

test("Shu clears the lower-left crate at either side of a tile boundary without artwork overlap", async ({
  page,
}) => {
  await page.goto("/");
  const results = await page.evaluate(async () => {
    const fixturePath = "/src/showcase.ts",
      sharedPath = "/@fs/workspace/crazy-arcade/packages/shared/src/index.ts";
    const { mountRendererFixture } = await import(fixturePath);
    const { movePlayer, EMPTY_INPUT, canOccupy } = await import(sharedPath);
    const root = document.createElement("div");
    root.id = "corner-repro";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:99999";
    document.body.append(root);
    const f = mountRendererFixture(root);
    f.state.arenaId = "pirate-lion";
    f.state.map.forEach((r: any[]) => r.fill("floor"));
    f.state.map[5][3] = "crate";
    f.state.mapRevision++;
    f.state.players = [f.state.players[0]];
    f.state.items = [];
    f.state.balloons = [];
    f.state.round = undefined;
    const p = f.state.players[0];
    p.characterId = 5;
    p.invulnerableUntil = 0;
    p.position = { x: 4.02, y: 4.51 };
    await f.ready;
    const results = [];
    for (const x of [3.98, 4.02, 4.13]) {
      p.position = { x, y: 4.51 };
      let safe = true,
        cardinal = true,
        overlap = false;
      for (let i = 0; i < 60; i++) {
        const old = { ...p.position };
        movePlayer(f.state, p, { ...EMPTY_INPUT, y: 1 }, 1000 / 60);
        safe &&= canOccupy(f.state, p, p.position.x, p.position.y);
        cardinal &&= old.x === p.position.x || old.y === p.position.y;
        await new Promise((r) => setTimeout(r, 17));
        // Actual displayed sprite bounds versus the crate's 40x48 image rectangle.
        for (const a of f.characterVisibleBounds())
          if (a.left < 160 && a.right > 120 && a.top < 240 && a.bottom > 192)
            overlap = true;
      }
      results.push({
        safe,
        cardinal,
        overlap,
        x: p.position.x,
        y: p.position.y,
      });
    }
    (window as any).cornerFixture = f;
    return results;
  });
  for (const r of results) {
    expect(r.safe).toBe(true);
    expect(r.cardinal).toBe(true);
    expect(r.overlap).toBe(false);
    expect(r.x).toBeGreaterThanOrEqual(4.49);
    expect(r.y).toBeGreaterThan(6);
  }
  await page
    .locator("#corner-repro")
    .screenshot({ path: "test-results/corner-shu-clearance.png" });
  await page.evaluate(() => (window as any).cornerFixture.destroy());
});
