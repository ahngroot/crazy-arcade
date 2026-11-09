import { test, expect } from "@playwright/test";
test("overlapping arrows prioritize the latest press, ignore repeat, restore held keys and retain quick turn edges", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/src/game.ts";
    const { GameKeyboard } = await import(path);
    const keyboard = new GameKeyboard();
    keyboard.setEnabled(true);
    (window as any).overlapKeyboard = keyboard;
  });
  const input = () =>
    page.evaluate(() => (window as any).overlapKeyboard.input());
  await page.keyboard.down("ArrowDown");
  expect(await input()).toMatchObject({ x: 0, y: 1, turn: "down" });
  await page.keyboard.down("ArrowRight");
  const right = await input();
  expect(right).toMatchObject({ x: 1, y: 0, turn: "right" });
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "ArrowDown", repeat: true }),
    ),
  );
  expect(await input()).toEqual(right);
  await page.keyboard.up("ArrowRight");
  expect(await input()).toMatchObject({
    x: 0,
    y: 1,
    turn: "right",
    turnId: right.turnId,
  });
  await page.keyboard.down("ArrowUp");
  expect(await input()).toMatchObject({ x: 0, y: -1 });
  await page.keyboard.up("ArrowUp");
  expect(await input()).toMatchObject({ x: 0, y: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect(await input()).toMatchObject({ x: 0, y: 0 });
  await page.keyboard.up("ArrowDown");
  await page.evaluate(() => (window as any).overlapKeyboard.destroy());
});
