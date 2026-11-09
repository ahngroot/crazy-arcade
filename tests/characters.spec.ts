import { test, expect } from "./fixtures";

test("selects one of 13 equal-stat characters before solo play and keeps it through restart and reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("radio")).toHaveCount(13);
  await page.getByRole("radio", { name: "케피", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "케피", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.screenshot({
    path: "test-results/character-selection.png",
    fullPage: true,
  });
  await page.locator("#practice").click();
  const self = page.locator("[data-player=p1]");
  await expect(self).toHaveAttribute("data-character", "12");
  await expect(self.locator('[data-stat="speed"]')).toHaveText("3.0칸/초");
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
  await expect(self).toHaveAttribute("data-character", "12");
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "케피", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});

test("online guest uses the selected character while the host keeps their own selection", async ({
  page,
  duel,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "모스", exact: true }).click();
  await duel(page, { guest: true, navigate: false });
  await expect(page.locator("[data-player=p2]")).toHaveAttribute(
    "data-character",
    "9",
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
