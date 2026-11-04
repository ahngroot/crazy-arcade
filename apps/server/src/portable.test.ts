import { afterEach, expect, it } from "vitest";
import { createServer } from "node:http";
import express from "express";
import { embeddedClient, listenLocal, portableOptions } from "./portable";
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0))
    if (server.listening)
      await new Promise<void>((done) => server.close(() => done()));
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
  const url = await listenLocal(server, 0);
  expect(server.address()).toMatchObject({ address: "127.0.0.1" });
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

it("chooses another free local port when default 3001 is occupied", async () => {
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
  const url = await listenLocal(server);
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
