import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  copyFileSync,
  chmodSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";
import { io as connect, type Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents, RoomView } from "@bubble/shared";

const executable = resolve(
  process.argv[2] ??
    `release/crazy-myangcade${process.platform === "win32" ? ".exe" : "-linux"}`,
);
if (!existsSync(executable))
  throw Error(`Build the executable first: ${executable}`);
const isolated = mkdtempSync(join(tmpdir(), "myangcade 게임 테스트 "));
const copied = join(
  isolated,
  process.platform === "win32" ? "크레이지 먕케이드.exe" : "크레이지 먕케이드",
);
copyFileSync(executable, copied);
if (process.platform !== "win32") chmodSync(copied, 0o755);
const childEnvironment = { ...process.env };
for (const key of Object.keys(childEnvironment))
  if (["PATH", "NODE_PATH", "NODE_OPTIONS"].includes(key.toUpperCase()))
    delete childEnvironment[key];
Object.assign(childEnvironment, { PATH: "", NODE_PATH: "", NODE_OPTIONS: "" });
const child = spawn(copied, ["--no-browser", "--port", "0"], {
  cwd: isolated,
  env: childEnvironment,
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "",
  stopped = false;
child.stdout.on("data", (data) => {
  logs = (logs + data).slice(-8000);
});
child.stderr.on("data", (data) => {
  logs = (logs + data).slice(-8000);
});
const exited = new Promise<void>((done, reject) => {
  child.once("error", reject);
  child.once("exit", () => {
    stopped = true;
    done();
  });
});
const sockets: Socket<ServerEvents, ClientEvents>[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
async function waitFor<T>(
  get: () => T | undefined,
  timeout = 15000,
): Promise<T> {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = get();
    if (value !== undefined) return value;
    if (stopped) throw Error(`Portable process exited: ${logs}`);
    await delay(30);
  }
  throw Error(`Portable smoke test timed out: ${logs}`);
}
try {
  const url = await waitFor(
    () => logs.match(/^GAME_URL=(http:\/\/127\.0\.0\.1:\d+)\r?$/m)?.[1],
  );
  const info = (await (await fetch(`${url}/connection-info`)).json()) as {
    lanUrls: string[];
  };
  const peerUrl =
    process.env.PORTABLE_BROWSER_LOOPBACK === "1"
      ? url
      : (info.lanUrls[0] ?? url);
  assert.equal((await fetch(`${peerUrl}/health`)).status, 200);
  const health = await fetch(`${url}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
  const html = await (await fetch(url)).text();
  assert.match(html, /크레이지 먕케이드/);
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(
    (m) => m[1],
  );
  assert.ok(assets.length >= 2);
  for (const asset of assets)
    assert.equal((await fetch(new URL(asset, url))).status, 200);
  const views: Map<number, RoomView>[] = [new Map(), new Map()];
  for (let i = 0; i < 2; i++) {
    const socket: Socket<ServerEvents, ClientEvents> = connect(url, {
      autoConnect: false,
      transports: ["websocket"],
      extraHeaders: { Origin: url },
    });
    sockets.push(socket);
    socket.on("room", (view) => {
      if (view.phase === "PLAYING") views[i].set(view.tick, view);
    });
    await new Promise<void>((done, reject) => {
      socket.once("connect", done);
      socket.once("connect_error", reject);
      socket.connect();
    });
  }
  const created = await sockets[0]
    .timeout(3000)
    .emitWithAck("createRoom", { nickname: "Portable A", durationMs: 30000 });
  if (!created.ok) throw Error(created.error);
  const joined = await sockets[1].timeout(3000).emitWithAck("joinRoom", {
    nickname: "Portable B",
    code: created.room.code,
  });
  assert.equal(joined.ok, true);
  await Promise.all(
    sockets.map((s) => s.timeout(3000).emitWithAck("readyRoom", true)),
  );
  const [a, b] = await waitFor(() => {
    for (const [tick, a] of views[0]) {
      const b = views[1].get(tick);
      if (tick >= 2 && b) return [a, b] as const;
    }
    return undefined;
  });
  assert.deepEqual(
    a.game?.players.map((p) => p.score),
    b.game?.players.map((p) => p.score),
  );
  assert.equal(a.game?.time, b.game?.time);
  sockets[0].emit("input", {
    roundId: a.roundId,
    sequence: 1,
    x: 0,
    y: 0,
    balloon: false,
    useItem: true,
  });
  await waitFor(() =>
    [...views[1].values()].find(
      (v) => v.game?.players[0].inventory.length === 1,
    ),
  );
  sockets.forEach((s) => s.disconnect());

  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await expect(page).toHaveTitle("크레이지 먕케이드 · crazy myangcade");
  await expect(page.locator("#connection")).toHaveText("게임 서버 연결됨");
  await expect(page.locator("#competition,#practice")).toHaveCount(0);
  await page.locator("#online").click();
  await page.getByLabel("닉네임", { exact: true }).fill("Portable Host");
  await page.locator("#online-create").click();
  await expect(page.locator("#room-code")).toHaveText(/^[A-HJ-NP-Z2-9]{8}$/);
  const code = await page.locator("#room-code").textContent();
  const peer = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  peer.on("pageerror", (error) => errors.push(error.message));
  await peer.goto(`${peerUrl}/?room=${code}`);
  await peer.getByLabel("닉네임", { exact: true }).fill("Portable Guest");
  await peer.locator("#online-join").click();
  await expect(page.locator("#room-players li")).toHaveCount(2);
  await page.locator("#online-ready").click();
  await peer.locator("#online-ready").click();
  await expect(peer.locator("#game-arena")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 15000 },
  );
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(
    page.locator("[data-player=p1] [data-stat=inventory-count]"),
  ).toHaveText("2 / 2");
  await page.keyboard.press("ControlLeft");
  await expect(
    page.locator("[data-player=p1] [data-stat=inventory-count]"),
  ).toHaveText("1 / 2");
  await page.keyboard.press("ControlLeft");
  await expect(page.locator("[data-player=p1] [data-stat=range]")).toHaveText(
    "3칸",
  );
  await peer.keyboard.press("ControlRight");
  await expect(
    peer.locator("[data-player=p2] [data-stat=inventory-count]"),
  ).toHaveText("1 / 2");
  await peer.keyboard.press("Space");
  await expect(peer.locator("[data-player=p2] [data-stat=balloon]")).toHaveText(
    "1 / 1",
  );
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () =>
      Number(await page.locator("[data-player=p1]").getAttribute("data-y")),
    )
    .toBeGreaterThan(2);
  await page.keyboard.up("ArrowDown");
  await expect(peer.locator("[data-player=p2]")).toHaveAttribute(
    "data-y",
    "1.500",
  );
  await peer.keyboard.down("ArrowDown");
  await expect
    .poll(async () =>
      Number(await peer.locator("[data-player=p2]").getAttribute("data-y")),
    )
    .toBeGreaterThan(2);
  await peer.keyboard.up("ArrowDown");
  mkdirSync("test-results/portable", { recursive: true });
  await page.screenshot({
    path: "test-results/portable/game.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      platform: process.platform,
      standalone: true,
      nodeOnPath: false,
      isolatedUnicodeDirectory: true,
      embeddedAssets: true,
      websocketPlayers: 2,
      matchingScores: true,
      serverCtrlItem: true,
      browserPlayers: 2,
      lanConnection: peerUrl !== url,
      arrowsSpaceCtrl: true,
      fifoCtrl: true,
    }),
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  if (!stopped) child.kill("SIGTERM");
  const force = setTimeout(() => child.kill("SIGKILL"), 3000);
  await exited;
  clearTimeout(force);
  rmSync(isolated, { recursive: true, force: true });
}
