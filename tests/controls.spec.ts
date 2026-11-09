import { test, expect } from "./fixtures";

for (const guest of [false, true]) {
  test(`${guest ? "green guest" : "red host"} uses arrows, Space and either Ctrl for only their own character`, async ({
    page,
    duel,
  }) => {
    await duel(page, { guest });
    const self = page.locator(`[data-player=${guest ? "p2" : "p1"}]`);
    const other = page.locator(`[data-player=${guest ? "p1" : "p2"}]`);
    await expect(self.locator("h3")).toContainText("나 ·");
    await expect(other.locator("h3")).toContainText("상대 ·");
    const arena = await page.locator("#game-arena canvas").boundingBox();
    const actions = await page.locator(".game-actions").boundingBox();
    expect(arena!.y + arena!.height).toBeLessThanOrEqual(actions!.y);
    await page.keyboard.down("s");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    await page.keyboard.up("s");
    await expect(self).toHaveAttribute("data-y", "1.500");
    await expect(self.locator('[data-stat="balloon"]')).toHaveText("0 / 1");
    await page.keyboard.down("ArrowDown");
    await expect
      .poll(async () => Number(await self.getAttribute("data-y")))
      .toBeGreaterThan(2);
    await page.keyboard.up("ArrowDown");
    await expect(other).toHaveAttribute("data-y", "1.500");

    await page.keyboard.down("ControlLeft");
    await expect(self.locator('[data-stat="inventory-count"]')).toHaveText(
      "0 / 2",
    );
    await page.keyboard.down("ControlRight");
    await page.keyboard.up("ControlLeft");
    await page.waitForTimeout(200);
    await expect(self.locator('[data-stat="inventory-count"]')).toHaveText(
      "0 / 2",
    );
    await page.keyboard.up("ControlRight");
    await page.keyboard.press("ControlRight");
    await expect(self.locator('[data-stat="inventory-count"]')).toHaveText(
      "0 / 2",
    );
    await expect(self.locator('[data-stat="range"]')).toHaveText("1칸");
    await expect(other.locator('[data-stat="inventory-count"]')).toHaveText(
      "0 / 2",
    );
    await page.keyboard.press("Space");
    await expect(self.locator('[data-stat="balloon"]')).toHaveText("1 / 1");
    await expect(other.locator('[data-stat="balloon"]')).toHaveText("0 / 1");
    await page.screenshot({
      path: `test-results/controls-${guest ? "green" : "red"}.png`,
      fullPage: true,
    });
  });
}

test("keyup and blur clear movement, UI controls retain focus and leaving removes the game", async ({
  page,
  duel,
}) => {
  await duel(page);
  const self = page.locator("[data-player=p1]");
  const dialog = page.locator("#game-dialog");
  const scroll = await dialog.evaluate((el) => el.scrollTop);
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () => Number(await self.getAttribute("data-y")))
    .toBeGreaterThan(2);
  await page.keyboard.up("ArrowDown");
  await page.waitForTimeout(400);
  const y = Number(await self.getAttribute("data-y"));
  await page.waitForTimeout(200);
  expect(Number(await self.getAttribute("data-y"))).toBeCloseTo(y, 1);
  expect(await dialog.evaluate((el) => el.scrollTop)).toBe(scroll);
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () => Number(await self.getAttribute("data-y")))
    .toBeGreaterThan(y + 0.2);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(400);
  const blurred = Number(await self.getAttribute("data-y"));
  await page.waitForTimeout(200);
  expect(Number(await self.getAttribute("data-y"))).toBeCloseTo(blurred, 1);
  await page.keyboard.up("ArrowDown");
  await page.locator("#game-audio [data-sound-volume]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#game-audio output")).toHaveText("36%");
  await expect(self).toHaveAttribute("data-x", "1.500");
  await page
    .getByRole("button", { name: "메뉴로 돌아가기", exact: true })
    .click();
  await expect(page.locator("#game-arena canvas")).toHaveCount(0);
  await expect(page.locator("#game-arena")).not.toHaveAttribute(
    "data-ready",
    "true",
  );
});

test("online match fits a narrow screen with accessible exit controls", async ({
  page,
  duel,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await duel(page);
  expect(
    await page
      .locator("#game-dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "메뉴로 돌아가기", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "test-results/online-mobile.png",
    fullPage: true,
  });
});
