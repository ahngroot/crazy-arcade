import { test, expect } from "./fixtures";

test("solo countdown displays 3, 2, 1 and Game Start while gameplay stays frozen", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#practice").click();
  const arena = page.locator("#game-arena"),
    cue = page.locator(".game-start-overlay");
  await expect(arena).toHaveAttribute("data-ready", "true");
  await expect(cue).toHaveText("3");
  const initialTick = await arena.getAttribute("data-tick");
  await page.keyboard.down("ArrowDown");
  await page.keyboard.down("Space");
  await page.keyboard.down("ControlLeft");
  await expect(cue).toHaveText("2");
  await expect(arena).toHaveAttribute("data-tick", initialTick!);
  await expect(page.locator("[data-player=p1]")).toHaveAttribute(
    "data-y",
    "1.500",
  );
  await expect(
    page.locator("[data-player=p1] [data-stat=inventory-count]"),
  ).toHaveText("2 / 2");
  await expect(page.locator("[data-player=p1] [data-stat=balloon]")).toHaveText(
    "0 / 1",
  );
  await expect(cue).toHaveText("1");
  await page.screenshot({
    path: "test-results/countdown-solo.png",
    fullPage: true,
  });
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  await page.keyboard.up("ControlLeft");
  await expect(cue).toHaveText("Game Start!");
  await expect(arena).toHaveAttribute("data-start-phase", "playing");
  await page.screenshot({
    path: "test-results/classic-practice-start.png",
    fullPage: true,
  });
  await expect(cue).toBeHidden();
  await page.keyboard.down("ArrowRight");
  await expect
    .poll(async () =>
      Number(await page.locator("[data-player=p1]").getAttribute("data-x")),
    )
    .toBeGreaterThan(2);
  await page.keyboard.up("ArrowRight");
  await page
    .getByRole("button", { name: "처음부터 다시", exact: true })
    .click();
  await expect(cue).toHaveText("3");
  await expect(arena).toHaveAttribute("data-tick", "0");
  await page
    .getByRole("button", { name: "메뉴로 돌아가기", exact: true })
    .click();
  await expect(cue).toHaveCount(0);
});

test("online start message appears in the arena when the server starts playing", async ({
  page,
  duel,
}) => {
  await duel(page, { durationMs: 30000 });
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-start-phase",
    "playing",
  );
  await expect(page.locator("#round-clock")).toHaveText(/00:30|00:29/);
  await expect(page.locator(".game-start-overlay")).toHaveText("Game Start!");
});
