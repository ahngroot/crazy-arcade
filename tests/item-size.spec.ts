import { test, expect } from "@playwright/test";
test("floor item artwork has the shield's visible extent without changing state", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const path = "/src/showcase.ts";
    const { mountRendererFixture } = (await import(
      path
    )) as typeof import("../apps/client/src/showcase");
    const root = document.createElement("div");
    root.id = "items-size";
    root.style.cssText =
      "position:fixed;inset:0;width:600px;height:520px;z-index:99999";
    document.body.append(root);
    const f = mountRendererFixture(root);
    await f.ready;
    const before = JSON.stringify(f.state),
      sizes = f.itemTextureExtents();
    (window as any).itemsSize = f;
    return { sizes, unchanged: before === JSON.stringify(f.state) };
  });
  expect(result.unchanged).toBe(true);
  const shield = result.sizes.find((s) => s.kind === "shield")!.extent;
  expect(shield).toBeGreaterThan(20);
  for (const item of result.sizes)
    expect(Math.abs(item.extent - shield), item.kind).toBeLessThanOrEqual(1);
  await page
    .locator("#items-size")
    .screenshot({ path: "test-results/items-shield-size.png" });
  await page.evaluate(() => (window as any).itemsSize.destroy());
});
