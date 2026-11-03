import { expect, test } from "@playwright/test";
test("menu renders, connects and opens both stage-one screens", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "작은 물방울로",
  );
  await expect(page.locator("#arena")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#arena canvas")).toBeVisible();
  await expect(page.locator("#connection")).toHaveText("개발 서버 연결됨");
  await page.screenshot({
    path: "test-results/menu-desktop.png",
    fullPage: true,
  });
  for (let visit = 0; visit < 2; visit++) {
    await page.getByRole("button", { name: /연습 모드/ }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "아직 구현되지 않았습니다",
    );
    await expect(page.locator("#practice-arena canvas")).toHaveCount(1);
    await page.getByRole("button", { name: "메뉴로 돌아가기" }).click();
    await expect(page.locator("#practice-arena canvas")).toHaveCount(0);
  }
  await page.getByRole("button", { name: /온라인 대전/ }).click();
  await expect(page.getByRole("dialog")).toContainText("게임방 기능은 준비 중");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("narrow screen has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#arena")).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("button", { name: /연습 모드/ })).toBeVisible();
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
