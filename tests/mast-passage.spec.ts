import { test, expect } from "@playwright/test";
test("the mast hides characters walking on its rear tiles while its three base cells stay solid", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const fixturePath = "/src/showcase.ts",
      sharedPath = "/@fs/workspace/crazy-arcade/packages/shared/src/index.ts";
    const { mountRendererFixture } = await import(fixturePath);
    const { ARENAS, createArenaMap, canOccupy, movePlayer, EMPTY_INPUT } =
      await import(sharedPath);
    const root = document.createElement("div");
    root.id = "mast-rear";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:99999";
    document.body.append(root);
    const f = mountRendererFixture(root);
    f.state.arenaId = "pirate-mast";
    f.state.map = createArenaMap(
      ARENAS.find((a: any) => a.id === "pirate-mast"),
    );
    f.state.mapRevision++;
    f.state.players = [f.state.players[0]];
    f.state.items = [];
    f.state.balloons = [];
    f.state.round = undefined;
    const p = f.state.players[0];
    p.position = { x: 6.5, y: 5.5 };
    p.characterId = 5;
    p.invulnerableUntil = 0;
    await f.ready;
    for (let i = 0; i < 40; i++)
      movePlayer(f.state, p, { ...EMPTY_INPUT, x: 1 }, 16);
    await new Promise((r) => setTimeout(r, 80));
    (window as any).mastFixture = f;
    return {
      x: p.position.x,
      y: p.position.y,
      mastDepth: f.mastDepth(),
      playerDepth: f.actorFrames()[0].depth,
      baseBlocked: [6, 7, 8].every((x) => !canOccupy(f.state, p, x + 0.5, 6.5)),
    };
  });
  expect(result.x).toBeGreaterThan(8);
  expect(result.y).toBe(5.5);
  expect(result.baseBlocked).toBe(true);
  expect(result.mastDepth).toBeGreaterThan(result.playerDepth);
  await page
    .locator("#mast-rear")
    .screenshot({ path: "test-results/mast-rear-passage.png" });
  await page.evaluate(() => (window as any).mastFixture.destroy());
});
