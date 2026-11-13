import { test, expect } from "./fixtures";

test("selects one of 14 equal-stat characters before solo play and keeps it through restart and reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page
      .getByRole("radiogroup", { name: "캐릭터 선택", exact: true })
      .getByRole("radio"),
  ).toHaveCount(14);
  await page.getByRole("radio", { name: "로두마니", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "로두마니", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page
    .locator(".character-picker:not(.balloon-picker)")
    .screenshot({ path: "test-results/rodumani-picker.png" });
  await page.screenshot({
    path: "test-results/character-selection.png",
    fullPage: true,
  });
  await page.locator("#practice").click();
  const self = page.locator("[data-player=p1]");
  await expect(self).toHaveAttribute("data-character", "13");
  await expect(self.locator('[data-stat="speed"]')).toHaveText("4.0칸/초");
  await expect(self.locator('[data-stat="range"]')).toHaveText("1칸");
  await expect(self.locator('[data-stat="balloon"]')).toHaveText("0 / 1");
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-start-phase",
    "playing",
    { timeout: 10000 },
  );
  await page.screenshot({
    path: "test-results/character-solo.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "처음부터 다시", exact: true })
    .click();
  await expect(self).toHaveAttribute("data-character", "13");
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "로두마니", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});

test("online guest uses the selected character while the host keeps their own selection", async ({
  page,
  duel,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "로두마니", exact: true }).click();
  await duel(page, { guest: true, navigate: false });
  await expect(page.locator("[data-player=p2]")).toHaveAttribute(
    "data-character",
    "13",
  );
  await expect(page.locator("[data-player=p1]")).toHaveAttribute(
    "data-character",
    "0",
  );
  await page.screenshot({
    path: "test-results/character-online.png",
    fullPage: true,
  });
});
