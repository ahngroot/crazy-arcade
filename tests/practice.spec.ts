import { test, expect } from "./fixtures";

async function start(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /1인 연습 모드/ }).click();
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-player-count",
    "1",
  );
  await expect(page.locator("[data-player=p2]")).toBeHidden();
  await expect(page.locator("#round-bar")).toBeHidden();
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-map-theme",
    "battle",
  );
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-start-phase",
    "playing",
    { timeout: 10000 },
  );
}

test("solo practice works without an online connection and uses one character, arrows, Space and Ctrl", async ({
  page,
}) => {
  await page.route("**/socket.io/**", (route) => route.abort());
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await start(page);
  const self = page.locator("[data-player=p1]");
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () => Number(await self.getAttribute("data-y")))
    .toBeGreaterThan(2);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.press("ControlLeft");
  await expect(self.locator('[data-stat="inventory-count"]')).toHaveText(
    "0 / 2",
  );
  await page.keyboard.press("ControlRight");
  await expect(self.locator('[data-stat="inventory-count"]')).toHaveText(
    "0 / 2",
  );
  await expect(self.locator('[data-stat="range"]')).toHaveText("1칸");
  await page.keyboard.press("Space");
  await expect(self.locator('[data-stat="balloon"]')).toHaveText("1 / 1");
  await page
    .getByRole("button", { name: "처음부터 다시", exact: true })
    .click();
  await expect(self).toHaveAttribute("data-y", "1.500");
  await expect(self.locator('[data-stat="balloon"]')).toHaveText("0 / 1");
  await expect(self.locator('[data-stat="inventory-count"]')).toHaveText(
    "0 / 2",
  );
  await page.screenshot({
    path: "test-results/solo-practice.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "메뉴로 돌아가기", exact: true })
    .click();
  await expect(page.locator("#game-arena canvas")).toHaveCount(0);
  await start(page);
  await expect(self).toHaveAttribute("data-y", "1.500");
  expect(errors).toEqual([]);
});

test("solo balloon explosion, respawn and crate pickup work; restart restores the map", async ({
  page,
}) => {
  await page.goto("/");
  await start(page);
  const self = page.locator("[data-player=p1]");
  await page.keyboard.down("ArrowRight");
  await expect
    .poll(async () => Number(await self.getAttribute("data-x")))
    .toBeGreaterThan(2.2);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Space");
  await expect(self).toHaveAttribute("data-status", "trapped", {
    timeout: 6000,
  });
  await expect(self.locator('[data-stat="deaths"]')).toHaveText("1회", {
    timeout: 6000,
  });
  await expect(self).toHaveAttribute("data-status", "active");
  await page.keyboard.down("ArrowRight");
  await expect(self.locator('[data-stat="range"]')).toHaveText("2칸");
  await page.keyboard.up("ArrowRight");
  await page
    .getByRole("button", { name: "처음부터 다시", exact: true })
    .click();
  await expect(self).toHaveAttribute("data-x", "1.500");
  await expect(self.locator('[data-stat="deaths"]')).toHaveText("0회");
  await expect(self.locator('[data-stat="balloon"]')).toHaveText("0 / 1");
});

test("switching between solo practice and online restores the correct player panels and restart action", async ({
  page,
  duel,
}) => {
  await page.goto("/");
  await start(page);
  await page
    .getByRole("button", { name: "메뉴로 돌아가기", exact: true })
    .click();
  const opponent = await duel(page, { navigate: false });
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-player-count",
    "2",
  );
  await expect(page.locator("[data-player=p2]")).toBeVisible();
  await expect(page.locator("#round-bar")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "처음부터 다시", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "메뉴로 돌아가기", exact: true })
    .click();
  opponent.disconnect();
  await start(page);
  await expect(
    page.getByRole("button", { name: "처음부터 다시", exact: true }),
  ).toBeEnabled();
});
