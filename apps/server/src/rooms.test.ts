import { describe, it, expect } from "vitest";
import { GAME_CONFIG as C } from "@bubble/shared";
import { RoomService } from "./rooms";
import { CHARACTERS } from "@bubble/shared";

it("shares all 13 validated appearances without changing player stats and preserves them across resume", () => {
  for (let characterId = 0; characterId < CHARACTERS.length; characterId++) {
    const s = new RoomService(() => 1000);
    const a = s.create("a", "ip", {
      nickname: "A",
      durationMs: 30000,
      characterId,
    });
    if (!a.ok) throw Error(a.error);
    const b = s.join("b", "ip", {
      nickname: "B",
      code: a.room.code,
      characterId: 12 - characterId,
    });
    if (!b.ok) throw Error(b.error);
    s.ready("a", true);
    s.ready("b", true);
    const game = s.current("a")!.game!;
    expect(game.players.map((p) => p.characterId)).toEqual([
      characterId,
      12 - characterId,
    ]);
    for (const p of game.players) {
      expect([p.speed, p.capacity, p.range]).toEqual([
        C.movementTilesPerSecond,
        C.initialBalloons,
        C.initialRange,
      ]);
      expect(p.inventory).toEqual([]);
    }
    s.disconnect("a");
    const resumed = s.resume("new-a", "ip", { token: a.token });
    if (!resumed.ok) throw Error(resumed.error);
    expect(resumed.room.players.find((p) => p.id === "p1")!.characterId).toBe(
      characterId,
    );
  }
});

it("rejects untrusted appearance ids before creating a room", () => {
  for (const characterId of [-1, 13, 1.5, "2", null, {}, NaN]) {
    const s = new RoomService();
    expect(
      s.create("a", "ip", { nickname: "A", durationMs: 30000, characterId }).ok,
    ).toBe(false);
    expect(s.rooms.size).toBe(0);
  }
});
function setup() {
  let now = 1000;
  const service = new RoomService(() => now);
  const advance = (ms: number) => {
    for (let left = ms; left > 0; left -= 1000 / C.simulationHz) {
      now += Math.min(left, 1000 / C.simulationHz);
      service.advance();
    }
  };
  return { service, advance, now: () => now };
}
function pair() {
  const h = setup();
  const a = h.service.create("a", "ip", {
    nickname: "빨강",
    durationMs: 30_000,
  });
  if (!a.ok) throw Error(a.error);
  const b = h.service.join("b", "ip", { nickname: "초록", code: a.room.code });
  if (!b.ok) throw Error(b.error);
  return { ...h, a, b };
}
function start(h: ReturnType<typeof pair>) {
  h.service.ready("a", true);
  h.service.ready("b", true);
  h.advance(C.countdownMs + 50);
}
const packet = (sequence: number, roundId = 1) => ({
  sequence,
  roundId,
  x: 0,
  y: 1,
  balloon: false,
  useItem: false,
});
describe("server room lifecycle", () => {
  it("shares a frozen arena during countdown and rejects early movement, balloons and item use", () => {
    const h = pair();
    h.service.ready("a", true);
    h.service.ready("b", true);
    const view = h.service.current("a")!,
      game = view.game!;
    expect(view.phase).toBe("COUNTDOWN");
    expect(game).not.toBeNull();
    expect(game.time).toBe(0);
    expect(
      h.service.input("a", {
        ...packet(1, view.roundId),
        balloon: true,
        useItem: true,
      }),
    ).toBe(false);
    h.advance(C.countdownMs - 100);
    expect(game.time).toBe(0);
    expect(game.players[0].position).toEqual(game.players[0].spawn);
    expect(game.players[0].inventory).toEqual([]);
    expect(game.balloons).toHaveLength(0);
    h.advance(200);
    expect(h.service.current("a")?.phase).toBe("PLAYING");
    expect(h.service.current("a")?.game).toBe(game);
  });
  it("releases sessions, socket bindings, rooms and expired request buckets across repeated create/leave cycles", () => {
    const h = setup();
    for (let i = 0; i < 40; i++) {
      const result = h.service.create(`socket${i}`, `ip${i}`, {
        nickname: "A",
        durationMs: 30000,
      });
      if (!result.ok) throw Error(result.error);
      h.service.leave(`socket${i}`);
      expect(
        h.service.resume(`resume${i}`, `ip${i}`, { token: result.token }).ok,
      ).toBe(false);
    }
    expect(h.service.diagnostics()).toMatchObject({
      bindings: 0,
      sessions: 0,
      rooms: 40,
    });
    h.advance(C.emptyRoomTtlMs + 1000);
    expect(h.service.diagnostics()).toEqual({
      rooms: 0,
      bindings: 0,
      sessions: 0,
      rateLimitBuckets: 0,
    });
  });
  it("clears an old result when a new opponent joins after a rematch disconnect expires", () => {
    const h = pair();
    start(h);
    h.advance(30_100);
    h.service.ready("a", true);
    h.service.disconnect("b");
    h.advance(C.reconnectGraceMs + 100);
    const join = h.service.join("c", "ip", {
      nickname: "New",
      code: h.a.room.code,
    });
    expect(join.ok).toBe(true);
    expect(h.service.current("a")?.phase).toBe("WAITING");
    expect(h.service.current("a")?.game).toBeNull();
  });
  it("requires two ready members, counts down and preserves room isolation", () => {
    const h = setup(),
      a = h.service.create("a", "ip", { nickname: "A", durationMs: 30_000 });
    if (!a.ok) throw Error();
    expect(h.service.ready("a", true).ok).toBe(false);
    const b = h.service.join("b", "ip", { nickname: "B", code: a.room.code });
    expect(b.ok).toBe(true);
    const other = h.service.create("c", "ip", {
      nickname: "C",
      durationMs: C.roundMs,
    });
    expect(other.ok).toBe(true);
    h.service.ready("a", true);
    expect(h.service.current("a")?.phase).toBe("READY");
    h.service.ready("b", true);
    expect(h.service.current("a")?.phase).toBe("COUNTDOWN");
    h.advance(C.countdownMs + 50);
    expect(h.service.current("a")?.phase).toBe("PLAYING");
    expect(h.service.current("c")?.phase).toBe("WAITING");
    expect(h.service.current("a")?.players.map((p) => p.team)).toEqual([
      "red",
      "green",
    ]);
  });
  it("rejects a third user, malformed nicknames/codes and already bound sockets", () => {
    const h = pair();
    expect(
      h.service.join("c", "ip", { nickname: "C", code: h.a.room.code }).ok,
    ).toBe(false);
    expect(
      h.service.create("a", "ip", { nickname: "A", durationMs: 30_000 }).ok,
    ).toBe(false);
    for (const nickname of ["", "<script>", "a".repeat(17)])
      expect(
        h.service.create("c", "ip", { nickname, durationMs: 30_000 }).ok,
      ).toBe(false);
    expect(h.service.join("c", "ip", { nickname: "C", code: "BAD" }).ok).toBe(
      false,
    );
  });
  it("freezes during disconnect, reserves the slot, verifies token and restores the same identity", () => {
    const h = pair();
    start(h);
    h.advance(1000);
    const time = h.service.current("a")!.game!.time;
    h.service.disconnect("b");
    expect(h.service.current("a")?.paused).toBe(true);
    h.advance(1000);
    expect(h.service.current("a")!.game!.time).toBe(time);
    expect(
      h.service.join("c", "ip", { nickname: "C", code: h.a.room.code }).ok,
    ).toBe(false);
    expect(h.service.resume("c", "ip", { token: "0".repeat(64) }).ok).toBe(
      false,
    );
    const resumed = h.service.resume("newB", "ip", { token: h.b.token });
    expect(resumed.ok).toBe(true);
    if (resumed.ok) expect(resumed.playerId).toBe(h.b.playerId);
    expect(h.service.resume("thief", "ip", { token: h.b.token }).ok).toBe(
      false,
    );
    h.advance(500);
    expect(h.service.current("a")!.game!.time).toBeGreaterThan(time);
    expect(JSON.stringify(h.service.current("a"))).not.toContain(h.b.token);
  });
  it("cancels a countdown on disconnect and requires readiness again", () => {
    const h = pair();
    h.service.ready("a", true);
    h.service.ready("b", true);
    h.service.disconnect("b");
    h.advance(5000);
    expect(h.service.current("a")?.phase).toBe("WAITING");
    h.service.resume("b2", "ip", { token: h.b.token });
    expect(h.service.current("a")?.game).toBeNull();
    expect(h.service.current("a")?.players.every((p) => !p.ready)).toBe(true);
  });
  it("forfeits after grace expiry, rejects expired tokens and allows a new opponent", () => {
    const h = pair();
    start(h);
    h.service.disconnect("b");
    h.advance(C.reconnectGraceMs + 100);
    expect(h.service.current("a")?.phase).toBe("FINISHED");
    expect(h.service.current("a")!.game!.round!.winner).toBe("red");
    expect(h.service.resume("b2", "ip", { token: h.b.token }).ok).toBe(false);
    expect(
      h.service.join("c", "ip", { nickname: "New", code: h.a.room.code }).ok,
    ).toBe(true);
    expect(h.service.current("a")?.phase).toBe("WAITING");
  });
  it("ends on explicit leave and removes empty rooms after TTL", () => {
    const h = pair();
    start(h);
    h.service.leave("a");
    expect(h.service.current("b")!.game!.round!.winner).toBe("green");
    h.service.leave("b");
    h.advance(C.emptyRoomTtlMs + 100);
    expect(h.service.rooms.size).toBe(0);
  });
  it("finishes and restarts a full round only after both rematch votes", () => {
    const h = pair();
    start(h);
    h.advance(30_100);
    expect(h.service.current("a")?.phase).toBe("FINISHED");
    const old = h.service.current("a")!.roundId;
    const oldMap = h.service.current("a")!.game!.arenaId;
    h.service.ready("a", true);
    h.advance(500);
    expect(h.service.current("a")?.roundId).toBe(old);
    h.service.ready("b", true);
    h.advance(C.countdownMs + 50);
    expect(h.service.current("a")?.roundId).toBe(old + 1);
    expect(h.service.current("a")!.game!.arenaId).not.toBe(oldMap);
    expect(
      h.service.current("a")!.game!.players.every((p) => p.score === 0),
    ).toBe(true);
  });
});
describe("validated authoritative inputs", () => {
  it("uses FIFO items once per validated Ctrl edge, rejects duplicates and malformed actions, and isolates the other player", () => {
    const h = pair();
    start(h);
    const game = h.service.current("a")!.game!;
    for (const player of game.players) player.inventory = ["shield", "power"];
    expect(h.service.input("a", { ...packet(1), y: 0, useItem: 1 })).toBe(
      false,
    );
    const { useItem: _, ...missing } = packet(1);
    expect(h.service.input("a", missing)).toBe(false);
    const first = { ...packet(1), y: 0, useItem: true };
    expect(h.service.input("a", first)).toBe(true);
    h.advance(40);
    expect(game.players[0].inventory).toEqual(["power"]);
    expect(game.players[1].inventory).toEqual(["shield", "power"]);
    expect(h.service.input("a", first)).toBe(false);
    h.service.input("a", { ...packet(2), y: 0, useItem: true });
    h.advance(40);
    expect(game.players[0].inventory).toEqual(["power"]);
    h.service.input("a", { ...packet(3), y: 0, useItem: false });
    h.service.input("a", { ...packet(4), y: 0, useItem: true });
    h.advance(40);
    expect(game.players[0].inventory).toEqual([]);
    expect(game.players[0].powerUntil).toBeGreaterThan(game.time);
  });
  it("ignores duplicate, stale epoch, excessive and non-finite input", () => {
    const h = pair();
    start(h);
    expect(h.service.input("a", packet(1))).toBe(true);
    expect(h.service.input("a", packet(1))).toBe(false);
    expect(h.service.input("a", packet(2, 0))).toBe(false);
    expect(h.service.input("a", { ...packet(2), x: Infinity })).toBe(false);
    expect(h.service.input("a", { ...packet(2), x: "1" })).toBe(false);
    expect(h.service.input("a", { ...packet(2), balloon: 1 })).toBe(false);
    expect(h.service.input("unknown", packet(1))).toBe(false);
    let accepted = 0;
    for (let i = 2; i < 200; i++)
      if (h.service.input("a", packet(i))) accepted++;
    expect(accepted).toBeLessThan(90);
  });
  it("does not accept client positions or score and expires held input without heartbeats", () => {
    const h = pair();
    start(h);
    const game = h.service.current("a")!.game!,
      p = game.players[0];
    const origin = { ...p.position },
      x = Math.floor(origin.x),
      y0 = Math.floor(origin.y);
    const [dx, dy] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].find(([dx, dy]) => game.map[y0 + dy]?.[x + dx] === "floor")!;
    h.service.input("a", {
      ...packet(1),
      x: dx,
      y: dy,
      score: 999999,
      position: { x: 99, y: 99 },
    });
    h.advance(100);
    expect(p.score).toBe(0);
    expect(
      Math.hypot(p.position.x - origin.x, p.position.y - origin.y),
    ).toBeGreaterThan(0);
    h.advance(500);
    const stopped = { ...p.position };
    h.advance(500);
    expect(p.position).toEqual(stopped);
    expect(h.service.current("a")?.players[0].ack).toBe(1);
  });
  it("latches a quick balloon tap once and keeps all placement/damage server-side", () => {
    const h = pair();
    start(h);
    h.service.input("a", { ...packet(1), y: 0, balloon: true });
    h.service.input("a", { ...packet(2), y: 0, balloon: false });
    h.advance(40);
    expect(
      h.service.current("a")!.game!.balloons.filter((b) => b.owner === "p1"),
    ).toHaveLength(1);
    h.advance(500);
    expect(
      h.service.current("a")!.game!.balloons.filter((b) => b.owner === "p1"),
    ).toHaveLength(1);
  });
  it("rate-limits room guessing and validates duration", () => {
    const h = setup();
    expect(
      h.service.create("x", "ip", { nickname: "X", durationMs: 1 }).ok,
    ).toBe(false);
    for (let i = 0; i < 65; i++)
      h.service.join(`guess${i}`, "ip", { nickname: "X", code: "AAAAAAAA" });
    const answer = h.service.create("x", "ip", {
      nickname: "X",
      durationMs: 30_000,
    });
    expect(answer.ok).toBe(false);
    h.advance(61_000);
    expect(
      h.service.create("x", "ip", { nickname: "X", durationMs: 30_000 }).ok,
    ).toBe(true);
  });
  it("preserves release/repress edges between ticks without repeating a held button", () => {
    const h = pair();
    start(h);
    const game = h.service.current("a")!.game!;
    game.players[0].capacity = 3;
    const cells = game.map.flatMap((row, y) =>
      row.flatMap((tile, x) =>
        tile === "floor" &&
        (x !== Math.floor(game.players[0].position.x) ||
          y !== Math.floor(game.players[0].position.y))
          ? [{ x: x + 0.5, y: y + 0.5 }]
          : [],
      ),
    );
    h.service.input("a", { ...packet(1), y: 0, balloon: true });
    h.advance(40);
    game.players[0].position = cells[0];
    h.service.input("a", { ...packet(2), y: 0, balloon: false });
    h.service.input("a", { ...packet(3), y: 0, balloon: true });
    h.advance(40);
    expect(game.balloons).toHaveLength(2);
    game.players[0].position = cells[1];
    h.service.input("a", { ...packet(4), y: 0, balloon: true });
    h.advance(40);
    expect(game.balloons).toHaveLength(2);
  });
});
it("validates and carries short direction presses to the authoritative tile movement", () => {
  const h = pair();
  start(h);
  const g = h.service.current("a")!.game!,
    p = g.players[0];
  g.map = g.map.map((row) => row.map(() => "floor"));
  g.round!.monsters = [];
  p.position = { x: 4.5, y: 4.5 };
  for (const turn of [["up"], { toString: null }, null])
    expect(h.service.input("a", { ...packet(1), turn, turnId: 1 })).toBe(false);
  expect(h.service.input("a", { ...packet(1), turn: "evil", turnId: 1 })).toBe(
    false,
  );
  expect(
    h.service.input("a", { ...packet(1), turn: "down", turnId: NaN }),
  ).toBe(false);
  expect(h.service.input("a", { ...packet(1), turn: "down", turnId: 1 })).toBe(
    true,
  );
  h.advance(100);
  expect(h.service.input("a", { ...packet(2), turn: "right", turnId: 2 })).toBe(
    true,
  );
  h.advance(100);
  for (let n = 3; n < 12; n++) {
    h.service.input("a", { ...packet(n), turn: "right", turnId: 2 });
    h.advance(100);
  }
  expect(p.position.x).toBe(5.5);
  expect(p.position.y).toBeGreaterThan(6.5);
});
