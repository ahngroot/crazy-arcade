import { test, expect } from "./fixtures";
import { ARENAS, arenaById } from "@bubble/shared";
import { assertEmptySpawn, readPosition } from "./map-helpers";

for (const arena of ARENAS)
  test(`reference arena renders: ${arena.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.evaluate(async (id) => {
      const path = "/src/showcase.ts";
      const { mountArenaFixture } = (await import(
        path
      )) as typeof import("../apps/client/src/showcase");
      const root = document.createElement("div");
      root.id = "arena-fixture";
      root.style.cssText =
        "position:fixed;left:0;top:0;width:600px;height:520px;z-index:9999;background:#111";
      document.body.append(root);
      const f = mountArenaFixture(root, id);
      await f.ready;
      (window as unknown as { arenaFixture: typeof f }).arenaFixture = f;
    }, arena.id);
    await expect(page.locator("#arena-fixture")).toHaveAttribute(
      "data-map-id",
      arena.id,
    );
    await page
      .locator("#arena-fixture")
      .screenshot({ path: `test-results/maps/${arena.id}.png` });
    await page.evaluate(() =>
      (
        window as unknown as { arenaFixture: { destroy: () => void } }
      ).arenaFixture.destroy(),
    );
    expect(errors).toEqual([]);
  });

test("solo restarts rotate the random arena and start on empty tiles with the same selected character", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "슈퍼 케피", exact: true }).click();
  await page.locator("#practice").click();
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  for (let n = 0; n < 4; n++) {
    await assertEmptySpawn(page);
    const id = await page.locator("#game-arena").getAttribute("data-map-id");
    await expect(page.locator("#current-map")).toContainText(
      arenaById(id!)!.name,
    );
    await expect(page.locator("[data-player=p1]")).toHaveAttribute(
      "data-character",
      "2",
    );
    await page
      .getByRole("button", { name: "처음부터 다시", exact: true })
      .click();
    await expect(page.locator("#game-arena")).not.toHaveAttribute(
      "data-map-id",
      id!,
    );
    await expect(page.locator(".game-start-overlay")).toHaveText("3");
  }
});

test("online snapshots share the chosen arena and random spawn positions", async ({
  page,
  duel,
}) => {
  const peer = await duel(page);
  const view = await new Promise<import("@bubble/shared").RoomView>((resolve) =>
    peer.once("room", resolve),
  );
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-map-id",
    view.game!.arenaId!,
  );
  for (const p of view.game!.players) {
    const pos = await assertEmptySpawn(page, p.id);
    expect(pos.x).toBeCloseTo(p.position.x, 2);
    expect(pos.y).toBeCloseTo(p.position.y, 2);
  }
  expect(await readPosition(page, "p1")).not.toEqual(
    await readPosition(page, "p2"),
  );
});
