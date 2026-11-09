import { test, expect } from "./fixtures";
import { moveSome } from "./map-helpers";

test("trapped solo player moves slowly, shows dwindling breath and dies once before respawning", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#practice").click();
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-start-phase",
    "playing",
    { timeout: 10000 },
  );
  const self = page.locator("[data-player=p1]");
  await expect(self.locator('[data-stat="inventory-count"]')).toHaveText(
    "0 / 2",
  );
  await page.keyboard.press("Space");
  await expect(self).toHaveAttribute("data-status", "trapped", {
    timeout: 6000,
  });
  await expect(self.locator('[data-stat="speed"]')).toHaveText("1.2칸/초");
  await moveSome(page, "p1", 0.25);
  await page.keyboard.press("Space");
  await expect(self.locator('[data-stat="balloon"]')).toHaveText("0 / 1");
  await page.screenshot({
    path: "test-results/trapped-moving.png",
    fullPage: true,
  });
  await expect(self.locator(".player-status")).toHaveText("물방울에 갇힘!");
  await expect(self.locator(".player-status")).not.toHaveText(/\d+초/);
  await page.screenshot({
    path: "test-results/trapped-last-breath.png",
    fullPage: true,
  });
  await expect(self).toHaveAttribute("data-status", "respawning", {
    timeout: 6000,
  });
  await page.waitForTimeout(850);
  await page.screenshot({
    path: "test-results/trapped-death.png",
    fullPage: true,
  });
  await expect(self).toHaveAttribute("data-status", "active");
  await expect(self.locator('[data-stat="deaths"]')).toHaveText("1회");
});
