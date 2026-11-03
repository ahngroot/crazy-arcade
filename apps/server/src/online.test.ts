import { afterEach, it, expect } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import {
  GAME_CONFIG as C,
  type ClientEvents,
  type ServerEvents,
  type RoomView,
} from "@bubble/shared";
import { createApp } from "./app";
let cleanup = async () => {};
afterEach(async () => cleanup());
it("real sockets enforce 2 seats, share server snapshots, recover identity and rematch", async () => {
  let now = 1000;
  const app = createApp(undefined, () => now);
  await new Promise<void>((resolve) =>
    app.http.listen(0, "127.0.0.1", resolve),
  );
  const url = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`;
  const clients: Socket<ServerEvents, ClientEvents>[] = [];
  cleanup = async () => {
    clients.forEach((c) => c.disconnect());
    await new Promise<void>((resolve) => app.io.close(() => resolve()));
  };
  async function client() {
    const socket: Socket<ServerEvents, ClientEvents> = connect(url, {
      autoConnect: false,
      transports: ["websocket"],
    });
    clients.push(socket);
    const connected = new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    socket.connect();
    await connected;
    return socket;
  }
  const a = await client(),
    b = await client(),
    c = await client();
  const created = await a
    .timeout(1000)
    .emitWithAck("createRoom", { nickname: "A", durationMs: 30_000 });
  if (!created.ok) throw Error(created.error);
  const joined = await b
    .timeout(1000)
    .emitWithAck("joinRoom", { nickname: "B", code: created.room.code });
  if (!joined.ok) throw Error(joined.error);
  expect(
    (
      await c
        .timeout(1000)
        .emitWithAck("joinRoom", { nickname: "C", code: created.room.code })
    ).ok,
  ).toBe(false);
  await a.timeout(1000).emitWithAck("readyRoom", true);
  await b.timeout(1000).emitWithAck("readyRoom", true);
  now += C.countdownMs + 1;
  app.rooms.advance();
  const snapshot = new Promise<RoomView>((resolve) => {
    const listener = (view: RoomView) => {
      if (view.phase === "PLAYING") {
        a.off("room", listener);
        resolve(view);
      }
    };
    a.on("room", listener);
  });
  expect((await snapshot).phase).toBe("PLAYING");
  a.emit("input", {
    sequence: 1,
    roundId: 1,
    x: 0,
    y: 0,
    balloon: true,
    needle: false,
    shield: false,
    power: false,
  });
  b.emit("input", {
    sequence: 1,
    roundId: 1,
    x: 0,
    y: 0,
    balloon: true,
    needle: false,
    shield: false,
    power: false,
  });
  await new Promise((resolve) => setTimeout(resolve, 15));
  now += 40;
  app.rooms.advance();
  expect(app.rooms.current(a.id!)!.game!.balloons).toHaveLength(2);
  // Controlled server fixture: verify a real engine kill becomes a nonzero
  // score on both sockets, rather than merely comparing two zero-score rooms.
  const game = app.rooms.current(a.id!)!.game!;
  game.round!.monsters = [
    {
      id: game.nextId++,
      team: "red",
      kind: "normal",
      position: { x: 1.5, y: 1.5 },
      home: { x: 1.5, y: 1.5 },
      target: null,
      bornAt: -1000,
    },
  ];
  game.balloons.find((balloon) => balloon.owner === "p1")!.explodesAt =
    game.time + 1;
  const scored = (socket: Socket<ServerEvents, ClientEvents>) =>
    new Promise<RoomView>((resolve) => {
      const listener = (view: RoomView) => {
        if ((view.game?.players[0].score ?? 0) > 0) {
          socket.off("room", listener);
          resolve(view);
        }
      };
      socket.on("room", listener);
    });
  const scoresA = scored(a),
    scoresB = scored(b);
  now += 40;
  app.rooms.advance();
  const [positiveA, positiveB] = await Promise.all([scoresA, scoresB]);
  expect(positiveA.game!.players[0].score).toBeGreaterThan(0);
  expect(positiveB.game!.players[0].score).toBe(
    positiveA.game!.players[0].score,
  );
  const bId = b.id!;
  b.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 15));
  expect(app.rooms.current(a.id!)?.paused).toBe(true);
  const restored = await client();
  const resume = await restored
    .timeout(1000)
    .emitWithAck("resumeRoom", { token: joined.token });
  expect(resume.ok).toBe(true);
  if (resume.ok) expect(resume.playerId).toBe(joined.playerId);
  expect(app.rooms.current(bId)).toBeNull();
  for (let i = 0; i < 910; i++) {
    now += 1000 / C.simulationHz;
    app.rooms.advance();
  }
  const views = app.rooms
    .broadcasts()
    .filter((v) => [a.id, restored.id].includes(v.socketId))
    .map((v) => v.view);
  expect(views).toHaveLength(2);
  expect(views[0].game).toEqual(views[1].game);
  expect(views[0].phase).toBe("FINISHED");
  await a.timeout(1000).emitWithAck("readyRoom", true);
  await restored.timeout(1000).emitWithAck("readyRoom", true);
  now += C.countdownMs + 1;
  app.rooms.advance();
  expect(app.rooms.current(a.id!)?.roundId).toBe(2);
});

it("rejects a browser handshake from a different origin host", async () => {
  const app = createApp();
  await new Promise<void>((resolve) =>
    app.http.listen(0, "127.0.0.1", resolve),
  );
  const client = connect(
    `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`,
    {
      autoConnect: false,
      reconnection: false,
      transports: ["websocket"],
      extraHeaders: { Origin: "https://foreign.invalid" },
    },
  );
  cleanup = async () => {
    client.disconnect();
    await new Promise<void>((resolve) => app.io.close(() => resolve()));
  };
  const error = new Promise<Error>((resolve) =>
    client.once("connect_error", resolve),
  );
  client.connect();
  expect(await error).toBeInstanceOf(Error);
  expect(client.connected).toBe(false);
});
