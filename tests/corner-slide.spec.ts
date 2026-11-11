import { test, expect } from "@playwright/test";
test("corner overlap clears sideways then continues in the held direction", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const fixturePath = "/src/showcase.ts",
      sharedPath = "/@fs/workspace/crazy-arcade/packages/shared/src/index.ts";
    const { mountRendererFixture } = await import(fixturePath);
    const { movePlayer, EMPTY_INPUT, canOccupy } = await import(sharedPath);
    const root = document.createElement("div");
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:99999";
    document.body.append(root);
    const f = mountRendererFixture(root);
    await f.ready;
    f.state.arenaId = "pirate-lion";
    f.state.map.forEach((r: any[]) => r.fill("floor"));
    f.state.map[3][3] = "wall";
    f.state.mapRevision++;
    const p = f.state.players[0];
    p.position = { x: 4.13, y: 4.28 };
    p.characterId = 0;
    let safe = true,
      cardinal = true;
    for (let i = 0; i < 50; i++) {
      const old = { ...p.position };
      movePlayer(f.state, p, { ...EMPTY_INPUT, y: -1 }, 1000 / 60);
      safe &&= canOccupy(f.state, p, p.position.x, p.position.y);
      cardinal &&= old.x === p.position.x || old.y === p.position.y;
      await new Promise((r) => setTimeout(r, 16));
    }
    const result = {
      safe,
      cardinal,
      x: p.position.x,
      y: p.position.y,
      facing: p.facing,
    };
    f.destroy();
    root.remove();
    return result;
  });
  expect(result.safe).toBe(true);
  expect(result.cardinal).toBe(true);
  expect(result.x).toBeGreaterThanOrEqual(4.28);
  expect(result.x).toBeLessThan(4.3);
  expect(result.y).toBeLessThan(3);
  expect(result.facing).toBe("up");
});
