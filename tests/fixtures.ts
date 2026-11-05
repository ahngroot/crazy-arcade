import { test as base, expect, type Page } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@bubble/shared";

type Opponent = Socket<ServerEvents, ClientEvents>;
type DuelOptions = { guest?: boolean; navigate?: boolean; durationMs?: number };

/** A real socket peer keeps UI tests on the production online path. */
export const test = base.extend<{
  duel: (page: Page, options?: DuelOptions) => Promise<Opponent>;
}>({
  duel: async ({}, use) => {
    const sockets: Opponent[] = [];
    await use(async (page, options = {}) => {
      if (options.navigate !== false) await page.goto("/");
      await page.locator("#online").click();
      await page.getByLabel("닉네임", { exact: true }).fill("Keyboard Player");
      const opponent: Opponent = io(new URL(page.url()).origin, {
        autoConnect: false,
        transports: ["websocket"],
      });
      sockets.push(opponent);
      await new Promise<void>((done, reject) => {
        opponent.once("connect", done);
        opponent.once("connect_error", reject);
        opponent.connect();
      });
      if (options.guest) {
        const created = await opponent.timeout(3000).emitWithAck("createRoom", {
          nickname: "Opponent",
          durationMs: options.durationMs ?? 180000,
        });
        if (!created.ok) throw Error(created.error);
        await page
          .getByLabel("방 코드", { exact: true })
          .fill(created.room.code);
        await page.locator("#online-join").click();
      } else {
        await page
          .getByLabel("온라인 경기 시간")
          .selectOption(String(options.durationMs ?? 180000));
        await page.locator("#online-create").click();
        await expect(page.locator("#online-lobby")).toBeVisible();
        await expect(page.locator("#room-code")).toHaveText(
          /^[A-HJ-NP-Z2-9]{8}$/,
        );
        const joined = await opponent.timeout(3000).emitWithAck("joinRoom", {
          nickname: "Opponent",
          code: await page.locator("#room-code").textContent(),
        });
        if (!joined.ok) throw Error(joined.error);
      }
      await expect(page.locator("#room-players li")).toHaveCount(2);
      const ready = await opponent.timeout(3000).emitWithAck("readyRoom", true);
      if (!ready.ok) throw Error(ready.error);
      await page.locator("#online-ready").click();
      await expect(page.locator("#game-arena")).toHaveAttribute(
        "data-ready",
        "true",
        { timeout: 15000 },
      );
      return opponent;
    });
    for (const socket of sockets) socket.disconnect();
  },
});
export { expect };
