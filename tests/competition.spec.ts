import { test, expect } from "@playwright/test";

test("default competition is 180 seconds and stays separate from unlimited practice", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel(/^경기 시간/)).toHaveValue("180000");
  await page.getByRole("button", { name: /꼬물이 대전/ }).click();
  await expect(page.locator("#practice-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator("#round-clock")).toHaveText(/03:00|02:59/);
  await expect(
    page.locator("[data-player=p1] [data-stat=monsters]"),
  ).toContainText("2 (대기 0)");
  await expect(page.locator("#special-controls")).toContainText("바늘 Q");
  await page.screenshot({
    path: "test-results/competition-start.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "메뉴로 돌아가기" }).click();
  await expect(page.locator("#practice-arena canvas")).toHaveCount(0);
  await page.getByRole("button", { name: /연습 모드/ }).click();
  await expect(page.locator("#practice-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator("#round-bar")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "처음부터 다시" }),
  ).toBeVisible();
});

test("two players use specials and balloons, finish a short round and rematch", async ({
  page,
}) => {
  test.setTimeout(65_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel(/^경기 시간/).selectOption("30000");
  await page.getByRole("button", { name: /꼬물이 대전/ }).click();
  await expect(page.locator("#practice-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.keyboard.down("e");
  await page.keyboard.down("k");
  await expect(page.locator("[data-player=p1] [data-stat=shield]")).toHaveText(
    "0",
  );
  await expect(page.locator("[data-player=p2] [data-stat=shield]")).toHaveText(
    "0",
  );
  await page.keyboard.up("e");
  await page.keyboard.up("k");
  await page.keyboard.down("r");
  await page.keyboard.down("l");
  await expect(page.locator("[data-player=p1] [data-stat=range]")).toHaveText(
    "3칸",
  );
  await expect(page.locator("[data-player=p2] [data-stat=power]")).toHaveText(
    "0",
  );
  await page.keyboard.up("r");
  await page.keyboard.up("l");
  await page.keyboard.down("Space");
  await page.keyboard.down("Enter");
  await expect(page.locator("[data-player=p1] [data-stat=balloon]")).toHaveText(
    "1 / 3",
  );
  await expect(page.locator("[data-player=p2] [data-stat=balloon]")).toHaveText(
    "1 / 3",
  );
  await page.keyboard.up("Space");
  await page.keyboard.up("Enter");
  await expect(page.locator("[data-player=p1] [data-stat=balloon]")).toHaveText(
    "0 / 3",
    { timeout: 6000 },
  );
  await expect(page.locator("[data-player=p1]")).toHaveAttribute(
    "data-status",
    "active",
  );
  await expect(page.locator("#round-bar")).toHaveAttribute(
    "data-warning",
    "final",
    { timeout: 20000 },
  );
  await page.screenshot({
    path: "test-results/competition-final-warning.png",
    fullPage: true,
  });
  await expect(page.getByRole("region", { name: "경기 결과" })).toBeVisible({
    timeout: 25000,
  });
  await expect(page.locator("#round-clock")).toHaveText("00:00");
  await expect(page.locator("#result-score")).toContainText("RED");
  await page.screenshot({
    path: "test-results/competition-result.png",
    fullPage: true,
  });
  const tick = await page.locator("#practice-arena").getAttribute("data-tick");
  const score = await page.locator("#red-score").textContent();
  await page.keyboard.press("Space");
  await expect(page.locator("#practice-arena")).toHaveAttribute(
    "data-tick",
    tick!,
  );
  await expect(page.locator("#red-score")).toHaveText(score!);
  await page.getByRole("button", { name: "재대결", exact: true }).click();
  await expect(page.locator("#result-panel")).toBeHidden();
  await expect(page.locator("#red-score")).toHaveText("0");
  await expect(page.locator("[data-player=p1] [data-stat=shield]")).toHaveText(
    "1",
  );
  await expect(page.locator("#round-clock")).toHaveText(/00:30|00:29/);
  expect(errors).toEqual([]);
});

test("competition fits a narrow screen with accessible exit controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /꼬물이 대전/ }).click();
  await expect(page.locator("#practice-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  expect(
    await page
      .locator("#practice-dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "메뉴로 돌아가기" }),
  ).toBeInViewport();
  await page.screenshot({
    path: "test-results/competition-mobile.png",
    fullPage: true,
  });
});
