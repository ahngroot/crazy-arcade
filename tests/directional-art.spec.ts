import { test, expect } from "@playwright/test";

test("reference profiles walk, whiten in a trap, burst prone and restore on respawn", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountRendererFixture } = await import(path);
    const root = document.createElement("div");
    root.id = "poses-fixture";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:9999;background:#111";
    document.body.append(root);
    const f = mountRendererFixture(root);
    await f.ready;
    f.state.players[0].characterId = 0;
    f.state.players[1].characterId = 5;
    f.state.players.forEach((p: any) => {
      p.moving = true;
      p.facing = "left";
    });
    (window as any).poses = f;
  });
  const frames = () =>
    page.evaluate(
      () =>
        (window as any).poses.actorFrames() as {
          key: string;
          visible: boolean;
          alpha: number;
          angle: number;
        }[],
    );
  for (const dir of ["left", "right", "up", "down"]) {
    await page.evaluate(
      (dir) =>
        (window as any).poses.state.players.forEach(
          (p: any) => (p.facing = dir),
        ),
      dir,
    );
    const prefix =
      dir === "down" ? "art-character-0-" : "art-direction-0-" + dir + "-";
    await expect
      .poll(async () => (await frames()).some((f) => f.key.startsWith(prefix)))
      .toBe(true);
    if (dir === "left" || dir === "right") {
      await expect
        .poll(async () =>
          (await frames()).some((f) =>
            f.key.startsWith(`art-direction-5-${dir}-`),
          ),
        )
        .toBe(true);
      const keys = new Set<string>();
      for (let n = 0; n < 8; n++) {
        keys.add((await frames()).find((f) => f.key.startsWith(prefix))!.key);
        await page.waitForTimeout(75);
      }
      expect(keys.size).toBeGreaterThanOrEqual(3);
    }
  }
  await page.evaluate(() => {
    const f = (window as any).poses;
    f.state.time = 100;
    f.state.players.forEach((p: any) => {
      p.status = "trapped";
      p.statusUntil = 5100;
    });
  });
  await expect
    .poll(
      async () =>
        (await frames()).filter((f) => f.key === "art-trapped" && f.visible)
          .length,
    )
    .toBe(2);
  await page
    .locator("#poses-fixture")
    .screenshot({ path: "test-results/trap-blue.png" });
  await page.evaluate(() => ((window as any).poses.state.time = 5000));
  await expect
    .poll(
      async () =>
        (await frames()).filter(
          (f) => f.key === "art-trapped-white" && f.alpha > 0.85 && f.visible,
        ).length,
    )
    .toBe(2);
  await page
    .locator("#poses-fixture")
    .screenshot({ path: "test-results/trap-white.png" });
  await page.evaluate(async () => {
    const sharedPath =
      "/@fs/workspace/crazy-arcade/packages/shared/src/index.ts";
    const shared = await import(sharedPath);
    const f = (window as any).poses;
    f.state.players.forEach((p: any) => shared.defeatPlayer(f.state, p));
    f.state.time += 650;
    (window as any).poseState = JSON.stringify(f.state);
  });
  await expect
    .poll(
      async () =>
        (await frames()).filter(
          (f) => f.key.startsWith("art-prone-") && f.visible,
        ).length,
    )
    .toBe(2);
  expect(
    (await frames())
      .filter((f) => f.key.startsWith("art-prone-"))
      .every((f) => f.angle === 0),
  ).toBe(true);
  await page
    .locator("#poses-fixture")
    .screenshot({ path: "test-results/prone-death.png" });
  expect(
    await page.evaluate(
      () =>
        JSON.stringify((window as any).poses.state) ===
        (window as any).poseState,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    const f = (window as any).poses;
    f.state.players.forEach((p: any) => {
      p.status = "active";
      p.moving = false;
      p.facing = "right";
    });
  });
  await expect
    .poll(
      async () =>
        (await frames()).filter(
          (f) => f.key === "art-trapped-white" && f.visible,
        ).length,
    )
    .toBe(0);
  await expect
    .poll(
      async () =>
        (await frames()).filter(
          (f) =>
            f.key.startsWith("art-direction-") && f.visible && f.alpha === 1,
        ).length,
    )
    .toBe(2);
  await page
    .locator("#poses-fixture")
    .screenshot({ path: "test-results/reference-profiles.png" });
  await page.evaluate(() => (window as any).poses.destroy());
});
