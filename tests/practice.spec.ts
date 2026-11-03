import { expect, test, type Page } from "@playwright/test";
const panel = (page: Page, id: string) => page.locator(`[data-player="${id}"]`);
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /연습 모드/ }).click();
  await expect(page.locator("#practice-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
}

test("both players move, place balloons, get trapped and respawn; restart clears the arena", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.keyboard.down("s");
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () => Number(await panel(page, "p1").getAttribute("data-y")))
    .toBeGreaterThan(2.4);
  await expect
    .poll(async () => Number(await panel(page, "p2").getAttribute("data-y")))
    .toBeGreaterThan(2.4);
  await page.keyboard.up("s");
  await page.keyboard.up("ArrowDown");
  await expect(panel(page, "p1")).toHaveAttribute("data-status", "active");
  await page.keyboard.down("Space");
  await page.keyboard.down("Enter");
  await expect(panel(page, "p1").locator('[data-stat="balloon"]')).toHaveText(
    "1 / 1",
  );
  await expect(panel(page, "p2").locator('[data-stat="balloon"]')).toHaveText(
    "1 / 1",
  );
  await page.keyboard.up("Space");
  await page.keyboard.up("Enter");
  await expect(panel(page, "p1")).toHaveAttribute("data-status", "trapped", {
    timeout: 6000,
  });
  await expect(panel(page, "p2")).toHaveAttribute("data-status", "trapped");
  await page.screenshot({
    path: "test-results/practice-trapped.png",
    fullPage: true,
  });
  await expect(panel(page, "p1").locator('[data-stat="deaths"]')).toHaveText(
    "1회",
    { timeout: 6000 },
  );
  await expect(panel(page, "p1")).toHaveAttribute("data-status", "active");
  await expect(panel(page, "p2")).toHaveAttribute("data-status", "active");
  await page.getByRole("button", { name: "처음부터 다시" }).click();
  await expect(panel(page, "p1")).toHaveAttribute("data-y", "1.500");
  await expect(panel(page, "p1").locator('[data-stat="deaths"]')).toHaveText(
    "0회",
  );
  await expect(panel(page, "p2").locator('[data-stat="balloon"]')).toHaveText(
    "0 / 1",
  );
  await page.screenshot({
    path: "test-results/practice-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("keyup, blur and closing practice clear held keys; keyboard does not scroll the dialog", async ({
  page,
}) => {
  await start(page);
  const dialog = page.locator("#practice-dialog");
  const scroll = await dialog.evaluate((el) => el.scrollTop);
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () => Number(await panel(page, "p2").getAttribute("data-y")))
    .toBeGreaterThan(2);
  await page.keyboard.up("ArrowDown");
  // Allow one in-flight render before measuring the stopped position.
  await page.waitForTimeout(60);
  const y = await panel(page, "p2").getAttribute("data-y");
  await page.waitForTimeout(150);
  expect(await panel(page, "p2").getAttribute("data-y")).toBe(y);
  expect(await dialog.evaluate((el) => el.scrollTop)).toBe(scroll);
  await page.keyboard.down("s");
  await expect
    .poll(async () => Number(await panel(page, "p1").getAttribute("data-y")))
    .toBeGreaterThan(2);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(60);
  const blurredY = await panel(page, "p1").getAttribute("data-y");
  await page.waitForTimeout(150);
  expect(await panel(page, "p1").getAttribute("data-y")).toBe(blurredY);
  await page.keyboard.up("s");
  await page.getByRole("button", { name: "메뉴로 돌아가기" }).click();
  await expect(page.locator("#practice-arena canvas")).toHaveCount(0);
  await page.getByRole("button", { name: /연습 모드/ }).click();
  await expect(page.locator("#practice-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(panel(page, "p1")).toHaveAttribute("data-y", "1.500");
  await page.waitForTimeout(150);
  await expect(panel(page, "p1")).toHaveAttribute("data-y", "1.500");
});

test("a real explosion breaks the starting crate and its item upgrades the HUD", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.down("Space");
  await expect(panel(page, "p1").locator('[data-stat="balloon"]')).toHaveText(
    "1 / 1",
  );
  await page.keyboard.up("Space");
  await expect(panel(page, "p1")).toHaveAttribute("data-status", "trapped", {
    timeout: 6000,
  });
  await expect(panel(page, "p1").locator('[data-stat="deaths"]')).toHaveText(
    "1회",
    { timeout: 6000 },
  );
  await expect(panel(page, "p1")).toHaveAttribute("data-status", "active");
  // The seeded first crate reward is a capacity upgrade. Passing through its old
  // tile and receiving the reward checks both destruction and pickup in the browser.
  await page.keyboard.down("d");
  await expect(panel(page, "p1").locator('[data-stat="balloon"]')).toHaveText(
    "0 / 2",
  );
  await expect
    .poll(async () => Number(await panel(page, "p1").getAttribute("data-x")))
    .toBeGreaterThan(2.3);
  await page.keyboard.up("d");
  expect(
    Number(await panel(page, "p1").getAttribute("data-x")),
  ).toBeGreaterThan(2);
  await page.screenshot({
    path: "test-results/practice-item.png",
    fullPage: true,
  });
});
