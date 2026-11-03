import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { createApp } from "../apps/server/src/app";

test("production client recovers after a real server shutdown and restart with expired rooms", async ({
  page,
}) => {
  test.setTimeout(30000);
  let app = createApp(resolve("apps/client/dist"));
  const start = async (port: number) =>
    new Promise<void>((done, reject) => {
      app.http.once("error", reject);
      app.http.listen(port, "127.0.0.1", done);
    });
  const stop = () => new Promise<void>((done) => app.io.close(() => done()));
  await start(0);
  const port = (app.http.address() as AddressInfo).port;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole("button", { name: /온라인 대전/ }).click();
    await page.getByLabel("닉네임", { exact: true }).fill("Restart");
    await expect(page.locator("#online-create")).toBeEnabled();
    await page.locator("#online-create").click();
    await expect(page.locator("#room-code")).toHaveText(/^[A-HJ-NP-Z2-9]{8}$/);
    await stop();
    await expect(page.locator("#lobby-status")).toContainText("서버 연결 끊김");
    await expect(page.locator("#online-create")).toBeDisabled();
    app = createApp(resolve("apps/client/dist"));
    await start(port);
    await expect(page.locator("#online-message")).toContainText("만료", {
      timeout: 15000,
    });
    await expect(page.locator("#online-setup")).toBeVisible();
    await expect(page.locator("#online-create")).toBeEnabled();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("bubble-room-session-v1"),
      ),
    ).toBeNull();
    await page.locator("#online-create").click();
    await expect(page.locator("#online-lobby")).toBeVisible();
    await expect(page.locator("#room-players li")).toHaveCount(1);
    await page.screenshot({
      path: "test-results/server-restarted.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await stop();
  }
});
