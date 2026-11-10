import { test, expect } from "@playwright/test";

test("placed balloons shimmer without changing simulation state and use a separate asset from capacity pickups", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountRendererFixture } = (await import(
      path
    )) as typeof import("../apps/client/src/showcase");
    const root = document.createElement("div");
    root.id = "balloon-fixture";
    root.style.cssText =
      "position:fixed;top:0;left:0;width:600px;height:520px;z-index:9999;background:#caf0d7";
    document.body.append(root);
    const f = mountRendererFixture(root);
    (window as unknown as { balloonFixture: typeof f }).balloonFixture = f;
    f.state.map[5][3] = "floor";
    f.state.mapRevision++;
    f.state.balloons = [
      {
        id: 991,
        owner: "p1",
        x: 3,
        y: 5,
        range: 1,
        explodesAt: 2500,
        passThrough: [],
      },
    ];
    await f.ready;
  });
  const before = await page.evaluate(() =>
    JSON.stringify(
      (window as unknown as { balloonFixture: { state: unknown } })
        .balloonFixture.state,
    ),
  );
  const sprite = page.locator("#balloon-fixture canvas");
  const box = (await sprite.boundingBox())!;
  const clip = { x: box.x + 116, y: box.y + 196, width: 48, height: 48 };
  const first = await page.screenshot({
    clip,
    path: "test-results/placed-balloon-first.png",
  });
  await page.waitForTimeout(220);
  const second = await page.screenshot({
    clip,
    path: "test-results/placed-balloon-shimmer.png",
  });
  expect(first.equals(second)).toBe(false);
  const frames = [];
  for (let n = 0; n < 12; n++) {
    frames.push(
      await page.evaluate(() =>
        (
          window as unknown as {
            balloonFixture: {
              balloonFrame: () => {
                x: number;
                y: number;
                shadowY: number;
                shadowWidth: number;
                key: string;
              };
            };
          }
        ).balloonFixture.balloonFrame(),
      ),
    );
    await page.waitForTimeout(80);
  }
  const height = frames.map((frame) => frame.y);
  expect(new Set(frames.map((frame) => frame.key)).size).toBeGreaterThanOrEqual(
    4,
  );
  const flowFrames = await page.evaluate(() => {
    const fixture = (window as any).balloonFixture;
    return Array.from({ length: 8 }, (_, frame) =>
      fixture.balloonTextureUrl(
        frame ? `art-balloon-flow-${frame}` : "art-balloon",
      ),
    );
  });
  expect(new Set(flowFrames).size).toBe(8);
  expect(Math.max(...height) - Math.min(...height)).toBeGreaterThan(3);
  expect(
    frames.every((frame) => frame.x === 140 && frame.shadowY === 233),
  ).toBe(true);
  const shadowWidth = frames.map((frame) => frame.shadowWidth);
  expect(Math.max(...shadowWidth) - Math.min(...shadowWidth)).toBeGreaterThan(
    2,
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify(
        (window as unknown as { balloonFixture: { state: unknown } })
          .balloonFixture.state,
      ),
    ),
  ).toBe(before);
  const assets = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((r) => r.name),
  );
  expect(assets.some((url) => url.includes("placed-balloon.png"))).toBe(true);
  expect(assets.some((url) => url.includes("passive-items.png"))).toBe(true);
  await page.evaluate(() =>
    (
      window as unknown as { balloonFixture: { destroy: () => void } }
    ).balloonFixture.destroy(),
  );
});
