import { test, expect } from "./fixtures";
import { readPosition, moveSome, freeDirection } from "./map-helpers";

for (const guest of [false, true]) {
  test(`${guest ? "green guest" : "red host"} uses arrows, Space and either Ctrl for only their own character`, async ({
    page,
    duel,
  }) => {
    await duel(page, { guest });
    const self = page.locator(`[data-player=${guest ? "p2" : "p1"}]`);
    const other = page.locator(`[data-player=${guest ? "p1" : "p2"}]`);
    const selfId = guest ? "p2" : "p1",
      otherId = guest ? "p1" : "p2";
    const start = await readPosition(page, selfId),
      otherStart = await readPosition(page, otherId);
    await expect(self.locator("h3")).toContainText("나 ·");
    await expect(other.locator("h3")).toContainText("상대 ·");
    const arena = await page.locator("#game-arena canvas").boundingBox();
    const actions = await page.locator(".game-actions").boundingBox();
    expect(arena!.y + arena!.height).toBeLessThanOrEqual(actions!.y);
    await page.keyboard.down("s");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    await page.keyboard.up("s");
    expect(await readPosition(page, selfId)).toEqual(start);
    await expect(self.locator('[data-stat="balloon"]')).toHaveText("0 / 1");
    await moveSome(page, selfId);
    expect(await readPosition(page, otherId)).toEqual(otherStart);

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
  await moveSome(page);
  await page.waitForTimeout(850);
  const released = await readPosition(page);
  await page.waitForTimeout(200);
  // Finish the current tile after release, then allow only subpixel online correction.
  const afterRelease = await readPosition(page);
  for (const axis of ["x", "y"] as const)
    expect(afterRelease[axis]).toBeCloseTo(released[axis], 2);
  expect(await dialog.evaluate((el) => el.scrollTop)).toBe(scroll);
  const direction = await freeDirection(page);
  await page.keyboard.down(direction.key);
  await expect
    .poll(
      async () =>
        direction.sign *
        ((await readPosition(page))[direction.axis] - direction.from),
    )
    .toBeGreaterThan(0.2);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(850);
  const blurred = await readPosition(page);
  await page.waitForTimeout(200);
  const afterBlur = await readPosition(page);
  for (const axis of ["x", "y"] as const)
    expect(afterBlur[axis]).toBeCloseTo(blurred[axis], 2);
  await page.keyboard.up(direction.key);
  const beforeSlider = await readPosition(page);
  await page.locator("#game-audio [data-sound-volume]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#game-audio output")).toHaveText("36%");
  expect(await readPosition(page)).toEqual(beforeSlider);
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
