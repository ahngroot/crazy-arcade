import { expect, test } from "@playwright/test";
test("menu exposes solo practice and online play with single-player controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("크레이지 먕케이드 · crazy myangcade");
  await expect(
    page.getByRole("link", { name: "크레이지 먕케이드 홈" }),
  ).toContainText("crazy myangcade");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "먕케이드",
  );
  await expect(page.locator("#arena")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#arena canvas")).toBeVisible();
  await expect(page.locator("#connection")).toHaveText("게임 서버 연결됨");
  await page.screenshot({
    path: "test-results/menu-desktop.png",
    fullPage: true,
  });
  await expect(page.locator("#competition,#round-duration")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /1인 연습 모드/ }),
  ).toBeVisible();
  await expect(page.locator(".bottom-grid")).toContainText("↑ ↓ ← →");
  await expect(page.locator(".bottom-grid")).toContainText("CTRL");
  await page.getByRole("button", { name: /온라인 대전/ }).click();
  await expect(page.getByRole("dialog")).toContainText("방 만들기");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("narrow screen has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#arena")).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("button", { name: /온라인 대전/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/menu-mobile.png",
    fullPage: true,
  });
});
