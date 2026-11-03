import { afterEach, expect, it } from "vitest";
import { io as connect } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
let cleanup = async () => {};
afterEach(async () => cleanup());
it("serves health and completes a real Socket.IO handshake and ping", async () => {
  const server = createApp();
  await new Promise<void>((resolve, reject) => {
    server.http.once("error", reject);
    server.http.listen(0, "127.0.0.1", resolve);
  });
  const url = `http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;
  const client = connect(url, {
    autoConnect: false,
    transports: ["websocket"],
  });
  cleanup = async () => {
    client.disconnect();
    await new Promise<void>((resolve) => server.io.close(() => resolve()));
  };
  expect(await (await fetch(`${url}/health`)).json()).toEqual({
    status: "ok",
    stage: 1,
  });
  const hello = new Promise((resolve) => client.once("hello", resolve));
  client.connect();
  expect(await hello).toEqual({ protocol: 1, stage: 1, maxPlayers: 2 });
  const time = await client.timeout(1000).emitWithAck("pingCheck");
  expect(Math.abs(Date.now() - time)).toBeLessThan(1000);
});
