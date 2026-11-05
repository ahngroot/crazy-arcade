import { test, expect, type Page } from "@playwright/test";
async function lobby(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: /온라인 대전/ }).click();
  await page.getByLabel("닉네임", { exact: true }).fill(name);
}
test("two independent browsers share a room, reconnect and rematch; a third is rejected and rooms stay isolated", async ({
  page,
  browser,
}) => {
  test.setTimeout(100_000);
  const bContext = await browser.newContext(),
    cContext = await browser.newContext();
  const b = await bContext.newPage(),
    c = await cContext.newPage();
  const errors: string[] = [];
  for (const p of [page, b, c])
    p.on("pageerror", (error) => errors.push(error.message));
  try {
    await lobby(page, "Host");
    await page.getByLabel("온라인 경기 시간").selectOption("30000");
    await page.getByRole("button", { name: "방 만들기", exact: true }).click();
    await expect(page.locator("#room-code")).toHaveText(/^[A-HJ-NP-Z2-9]{8}$/);
    const code = await page.locator("#room-code").textContent();
    await expect(
      page.getByRole("button", { name: "READY", exact: true }),
    ).toBeDisabled();
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "코드 복사", exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      code,
    );
    await page.getByRole("button", { name: "초대 링크 복사" }).click();
    const invitation = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(invitation).toContain(`room=${code}`);
    expect(new URL(invitation).hostname).not.toBe("127.0.0.1");
    expect(new URL(invitation).port).toBe(new URL(page.url()).port);
    const inviteUrl = new URL(invitation);
    // Managed cloud browsers may forbid private-IP navigation. Keep that limit explicit.
    if (process.env.PLAYWRIGHT_LOOPBACK_INVITES === "1")
      inviteUrl.hostname = new URL(page.url()).hostname;
    await b.goto(inviteUrl.href);
    await b.getByLabel("닉네임", { exact: true }).fill("Guest");
    await expect(b.getByLabel("방 코드", { exact: true })).toHaveValue(code!);
    await b.getByRole("button", { name: "방 참가하기", exact: true }).click();
    await expect(page.locator("#room-players li")).toHaveCount(2);
    await expect(b.locator("#online-team")).toHaveText("내 팀 · GREEN");
    await lobby(c, "Third");
    await c.getByLabel("방 코드", { exact: true }).fill(code!);
    await c.getByRole("button", { name: "방 참가하기", exact: true }).click();
    await expect(c.locator("#online-message")).toContainText("최대 2명");
    await c.getByRole("button", { name: "방 만들기", exact: true }).click();
    await expect(c.locator("#room-code")).not.toHaveText(code!);
    await page.getByRole("button", { name: "READY", exact: true }).click();
    await b.getByRole("button", { name: "READY", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "온라인 대전 · 빨강 팀" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      b.getByRole("heading", { name: "온라인 대전 · 초록 팀" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#game-arena")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(b.locator("#game-arena")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.keyboard.down("ControlRight");
    await expect(
      page.locator("[data-player=p1] [data-stat=inventory-count]"),
    ).toHaveText("1 / 2");
    await expect(
      b.locator("[data-player=p2] [data-stat=inventory-count]"),
    ).toHaveText("2 / 2");
    await page.keyboard.up("ControlRight");
    await page.keyboard.down("ControlRight");
    await expect(page.locator("[data-player=p1] [data-stat=range]")).toHaveText(
      "3칸",
    );
    await page.keyboard.up("ControlRight");
    await page.keyboard.down("Space");
    await expect(
      page.locator("[data-player=p1] [data-stat=balloon]"),
    ).toHaveText("1 / 3");
    await page.keyboard.up("Space");

    await b.keyboard.down("ControlLeft");
    await expect(
      b.locator("[data-player=p2] [data-stat=inventory-count]"),
    ).toHaveText("1 / 2");
    await b.keyboard.up("ControlLeft");
    await b.keyboard.down("ControlLeft");
    await expect(b.locator("[data-player=p2] [data-stat=range]")).toHaveText(
      "3칸",
    );
    await b.keyboard.up("ControlLeft");
    await b.keyboard.down("Space");
    await expect(b.locator("[data-player=p2] [data-stat=balloon]")).toHaveText(
      "1 / 3",
    );
    await expect(b.locator("[data-player=p1] [data-stat=balloon]")).toHaveText(
      "1 / 3",
    );
    await b.keyboard.up("Space");

    await b.keyboard.down("ArrowDown");
    await expect
      .poll(async () =>
        Number(await b.locator("[data-player=p2]").getAttribute("data-y")),
      )
      .toBeGreaterThan(2);
    await b.keyboard.up("ArrowDown");
    await expect(c.locator("#lobby-status")).toContainText("상대 입장");
    await expect(c.locator("#game-dialog")).not.toBeVisible();
    const base = new URL(page.url()).origin;
    await page.goto("about:blank");
    await expect(b.locator("#network-message")).toContainText(
      "상대 연결 끊김",
      { timeout: 10000 },
    );
    await page.goto(base);
    await expect(
      page.getByRole("heading", { name: "온라인 대전 · 빨강 팀" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#game-arena")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.locator("#room-players li")).toHaveCount(2);
    await page.screenshot({
      path: "test-results/online-restored.png",
      fullPage: true,
    });
    await expect(page.getByRole("region", { name: "경기 결과" })).toBeVisible({
      timeout: 45000,
    });
    await expect(b.getByRole("region", { name: "경기 결과" })).toBeVisible({
      timeout: 10000,
    });
    await expect(b.locator("#result-score")).toHaveText(
      (await page.locator("#result-score").textContent())!,
    );
    await expect(b.locator("#result-title")).toHaveText(
      (await page.locator("#result-title").textContent())!,
    );
    await page.screenshot({
      path: "test-results/online-result.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "재대결 준비", exact: true })
      .click();
    await b.getByRole("button", { name: "재대결 준비", exact: true }).click();
    await expect(page.locator("#result-panel")).toBeHidden({ timeout: 10000 });
    await expect(b.locator("#result-panel")).toBeHidden({ timeout: 10000 });
    await expect(page.locator("#red-score")).toHaveText("0");
    await expect(b.locator("#green-score")).toHaveText("0");
    await page
      .getByRole("button", { name: "메뉴로 돌아가기", exact: true })
      .click();
    await expect(b.locator("#result-panel")).toBeVisible({ timeout: 10000 });
    await expect(b.locator("#result-title")).toHaveText("초록 팀 승리!");
    await expect(b.locator("#network-message")).toContainText("경기 종료");
    expect(errors).toEqual([]);
  } finally {
    await bContext.close();
    await cContext.close();
  }
});
