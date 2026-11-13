import { expect, test } from "@playwright/test";

test("practice pirate uses four source poses at the approved character size", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountRendererFixture } = await import(path);
    const root = document.createElement("div");
    root.id = "pirate-preview";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:99999;background:#d4eee0";
    document.body.append(root);
    const f = mountRendererFixture(root);
    await f.ready;
    const p = f.state.players[0];
    f.state.players = [
      {
        ...p,
        id: "uni",
        characterId: 1,
        position: { x: 2, y: 6 },
        moving: false,
      },
      ...(["down", "up", "left", "right"] as const).map((facing, i) => ({
        ...p,
        id: `pirate-${i}`,
        practiceOpponent: true,
        characterId: undefined,
        moving: false,
        facing,
        position: { x: 4.5 + i * 2.5, y: 6 },
      })),
    ];
    f.state.players.push({
      ...p,
      id: "selected-rodumani",
      characterId: 13,
      practiceOpponent: false,
      moving: false,
      facing: "down",
      position: { x: 14, y: 6 },
    });
    f.state.map.forEach((row: any[]) => row.fill("floor"));
    f.state.mapRevision++;
    f.state.items = [];
    f.state.round!.monsters = [];
    (window as any).pirateFixture = f;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).pirateFixture
            .actorFrames()
            .filter((x: any) => x.key.startsWith("art-practice-pirate")).length,
      ),
    )
    .toBe(5);
  const bounds = await page.evaluate(() =>
    (window as any).pirateFixture.characterVisibleBounds(),
  );
  expect(bounds).toHaveLength(6);
  for (const b of bounds) {
    expect(b.bottom - b.top).toBeCloseTo(47.37, 0);
    expect(b.right - b.left).toBeLessThanOrEqual(38.5);
    expect(b.bottom).toBeCloseTo(244, 0);
  }
  await page
    .locator("#pirate-preview")
    .screenshot({ path: "test-results/practice-pirate-poses.png" });
  const cycles = await page.evaluate(() => {
    const f = (window as any).pirateFixture;
    return ["down", "up", "left", "right"].map(
      (dir) =>
        new Set(
          Array.from({ length: 4 }, (_, i) =>
            f.characterTextureUrl(`art-practice-pirate-${dir}-walk-${i}`),
          ),
        ).size,
    );
  });
  expect(cycles.every((count) => count === 4)).toBe(true);
  const poses = await page.evaluate(() =>
    (window as any).pirateFixture
      .characterTextureInfo()
      .filter(
        (p: any) =>
          p.key.includes("practice-pirate") && p.key.includes("-walk-"),
      ),
  );
  expect(poses).toHaveLength(16);
  for (const pose of poses) {
    expect(pose.edgePixels, pose.key).toBe(0);
    expect(pose.footPixels, pose.key).toBeGreaterThan(70);
    expect(pose.height, pose.key).toBeGreaterThanOrEqual(142);
  }

  await page.evaluate(() =>
    (window as any).pirateFixture.state.players
      .slice(1)
      .forEach((p: any) => (p.moving = true)),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).pirateFixture
            .actorFrames()
            .filter(
              (x: any) => x.key.includes("pirate-") && x.key.includes("-walk-"),
            ).length,
      ),
    )
    .toBe(5);
  await page.evaluate(() =>
    (window as any).pirateFixture.state.players
      .slice(1)
      .forEach((p: any) => (p.moving = false)),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).pirateFixture
            .actorFrames()
            .filter(
              (x: any) =>
                x.key.includes("pirate-") && !x.key.includes("-walk-"),
            ).length,
      ),
    )
    .toBe(5);
});

test("solo opponent collects an item, installs a balloon and survives restart", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/renderer.ts";
    const { GameRenderer } = await import(path);
    const update = GameRenderer.prototype.update;
    GameRenderer.prototype.update = function (state: any, delta: number) {
      (window as any).observedPractice = state;
      return update.call(this, state, delta);
    };
  });
  await page.locator("#practice").click();
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.evaluate(() => {
    const s = (window as any).observedPractice;
    s.map.forEach((row: any[], y: number) =>
      row.forEach(
        (_: any, x: number) =>
          (row[x] =
            x === 0 || y === 0 || x === 14 || y === 12 ? "wall" : "floor"),
      ),
    );
    s.map[5][6] = "crate";
    s.mapRevision++;
    s.players[0].position = { x: 1.5, y: 1.5 };
    s.players[1].position = { x: 5.5, y: 5.5 };
    s.items = [{ id: 9999, kind: "range", x: 5, y: 5, availableAt: 0 }];
  });
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-start-phase",
    "playing",
    { timeout: 10000 },
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).observedPractice.players[1].range),
    )
    .toBe(2);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = (window as any).observedPractice;
          return s.balloons.some((b: any) => b.owner === s.players[1].id);
        }),
      { timeout: 10000 },
    )
    .toBe(true);
  await page
    .locator("#game-arena")
    .screenshot({ path: "test-results/practice-opponent-balloon.png" });
  const start = await page.evaluate(() =>
    JSON.stringify((window as any).observedPractice.players[1].position),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.stringify((window as any).observedPractice.players[1].position),
      ),
    )
    .not.toBe(start);
  const state = await page.evaluate(() => {
    const s = (window as any).observedPractice;
    return {
      count: s.players.length,
      bot: s.players[1].practiceOpponent,
    };
  });
  expect(state).toEqual({ count: 2, bot: true });
  await page
    .getByRole("button", { name: "처음부터 다시", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).observedPractice.players[1]?.practiceOpponent,
      ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
