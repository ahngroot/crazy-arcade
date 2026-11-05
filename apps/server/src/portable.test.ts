import { afterEach, expect, it } from "vitest";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import express from "express";
import {
  embeddedClient,
  listenGame,
  portableOptions,
  lanGameUrls,
} from "./portable";
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0))
    if (server.listening)
      await new Promise<void>((done) => server.close(() => done()));
});

it("binds all IPv4 interfaces and advertises the actual port", async () => {
  const app = express();
  app.use(
    embeddedClient(new Map([["/index.html", Buffer.from("online duel")]])),
  );
  const server = createServer(app);
  servers.push(server);
  const local = await listenGame(server, 0);
  expect(server.address()).toMatchObject({ address: "0.0.0.0" });
  const urls = lanGameUrls(local);
  expect(await (await fetch(local)).text()).toBe("online duel");
  for (const url of urls) {
    expect(new URL(url).port).toBe(new URL(local).port);
  }
});

it("offers unique private IPv4 addresses, excluding loopback and public interfaces", () => {
  const adapter = (address: string, internal = false) =>
    ({
      address,
      internal,
      family: "IPv4",
      netmask: "255.255.255.0",
      mac: "00:00:00:00:00:00",
      cidr: null,
    }) as const;
  const interfaces: ReturnType<typeof networkInterfaces> = {
    lo: [adapter("127.0.0.1", true)],
    wifi: [adapter("192.168.1.8"), adapter("192.168.1.8")],
    lan: [adapter("10.0.0.8"), adapter("172.16.0.8")],
    public: [adapter("203.0.113.8")],
  };
  expect(lanGameUrls("http://127.0.0.1:49152", interfaces)).toEqual([
    "http://192.168.1.8:49152",
    "http://10.0.0.8:49152",
    "http://172.16.0.8:49152",
  ]);
});

it("serves only embedded files with correct MIME, HEAD support and no filesystem fallback", async () => {
  const app = express();
  app.use(
    embeddedClient(
      new Map([
        ["/index.html", Buffer.from("<title>크레이지 먕케이드</title>")],
        ["/assets/game.js", Buffer.from('console.log("game")')],
      ]),
    ),
  );
  const server = createServer(app);
  servers.push(server);
  const url = await listenGame(server, 0);
  expect(server.address()).toMatchObject({ address: "0.0.0.0" });
  const index = await fetch(url);
  expect(index.headers.get("content-type")).toContain("text/html");
  expect(await index.text()).toContain("먕케이드");
  const script = await fetch(`${url}/assets/game.js`);
  expect(script.headers.get("content-type")).toMatch(/javascript/);
  expect(script.status).toBe(200);
  const head = await fetch(`${url}/assets/game.js`, { method: "HEAD" });
  expect(head.status).toBe(200);
  expect(await head.text()).toBe("");
  for (const path of ["/missing", "/%2e%2e%2fpackage.json", "/assets/%ZZ"])
    expect((await fetch(url + path)).status).toBe(
      path.endsWith("%ZZ") ? 400 : 404,
    );
});

it("chooses another free port when default 3001 is occupied", async () => {
  const blocker = createServer();
  servers.push(blocker);
  await new Promise<void>((done, reject) => {
    blocker.once("error", (error: NodeJS.ErrnoException) =>
      error.code === "EADDRINUSE" ? done() : reject(error),
    );
    blocker.listen(3001, "127.0.0.1", done);
  });
  const server = createServer();
  servers.push(server);
  const url = await listenGame(server);
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  expect(url).not.toBe("http://127.0.0.1:3001");
});

it("requires a packaged index page rather than silently starting an empty game", () => {
  expect(() => embeddedClient(new Map())).toThrow("index.html");
});

it("accepts only valid launch flags and rejects broken ports", () => {
  expect(portableOptions([])).toEqual({ port: 3001, noBrowser: false });
  expect(portableOptions(["--no-browser", "--port", "0"])).toEqual({
    port: 0,
    noBrowser: true,
  });
  for (const args of [
    ["--port"],
    ["--port", "-1"],
    ["--port", "1.5"],
    ["--port", "65536"],
    ["--unknown"],
  ])
    expect(() => portableOptions(args)).toThrow();
});
