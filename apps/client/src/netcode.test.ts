import { it, expect } from "vitest";
import {
  createCompetition,
  canOccupy,
  GAME_CONFIG as C,
  EMPTY_INPUT,
  type RoomView,
  type NetworkInput,
} from "@bubble/shared";
import { OnlineTimeline, hasActionTransition } from "./netcode";
function view(): RoomView {
  return {
    code: "ABCDEFGH",
    phase: "PLAYING",
    roundId: 1,
    tick: 0,
    serverTime: 0,
    countdownEndsAt: null,
    paused: false,
    reason: null,
    players: [
      {
        id: "p1",
        team: "red",
        nickname: "A",
        ready: false,
        connected: true,
        reconnectUntil: null,
        ack: 0,
      },
      {
        id: "p2",
        team: "green",
        nickname: "B",
        ready: false,
        connected: true,
        reconnectUntil: null,
        ack: 0,
      },
    ],
    game: createCompetition(),
  };
}
it("predicts only movement, emits sequenced input, and never predicts balloons, kills or score", () => {
  const sent: NetworkInput[] = [];
  const timeline = new OnlineTimeline(
    "p1",
    (packet) => sent.push(packet),
    () => 0,
  );
  const snapshot = view();
  timeline.receive(snapshot);
  const result = timeline.frame(
    { x: 0, y: 1, balloon: true, useItem: true },
    34,
    true,
  )!;
  expect(result.players[0].position.y).toBeGreaterThan(1.5);
  expect(result.balloons).toHaveLength(0);
  expect(result.players[0].inventory).toEqual([]);
  expect(sent[0].useItem).toBe(true);
  expect(result.players[0].score).toBe(0);
  expect(sent[0]).toMatchObject({ sequence: 1, roundId: 1, balloon: true });
  expect(snapshot.game!.players[0].position.y).toBe(1.5);
});
it("reconciles acknowledgements, rejects stale snapshots and stops sending when disconnected/paused", () => {
  const sent: NetworkInput[] = [];
  const t = new OnlineTimeline(
    "p1",
    (packet) => sent.push(packet),
    () => 0,
  );
  const a = view();
  t.receive(a);
  t.frame({ x: 0, y: 1, balloon: false }, 34, true);
  const b = view();
  b.tick = 2;
  b.players[0].ack = 1;
  b.game!.players[0].position.y = 1.6;
  t.receive(b);
  expect(t.view?.tick).toBe(2);
  t.receive(a);
  expect(t.view?.tick).toBe(2);
  t.frame(EMPTY_INPUT, 100, false);
  expect(sent).toHaveLength(1);
  b.paused = true;
  t.receive(b);
  t.frame(EMPTY_INPUT, 100, true);
  expect(sent).toHaveLength(1);
  t.resetConnection();
  expect(() => t.frame(EMPTY_INPUT, 100, false)).not.toThrow();
});
it("interpolates the other player between buffered snapshots and resets sequence each round", () => {
  let now = 0;
  const sent: NetworkInput[] = [];
  const t = new OnlineTimeline(
    "p1",
    (packet) => sent.push(packet),
    () => now,
  );
  const a = view();
  t.receive(a);
  now = 100;
  const b = view();
  b.tick = 2;
  b.game!.players[1].position.y = 2.5;
  t.receive(b);
  now = 150;
  const result = t.frame(EMPTY_INPUT, 34, true)!;
  expect(result.players[1].position.y).toBeCloseTo(2);
  const c = view();
  c.roundId = 2;
  now = 200;
  t.receive(c);
  t.frame(EMPTY_INPUT, 34, true);
  expect(sent.at(-1)?.sequence).toBe(1);
});

it("keeps prediction speed and input cadence consistent at 10 and 30 render FPS", () => {
  const run = (delta: number, count: number) => {
    const sent: NetworkInput[] = [];
    const t = new OnlineTimeline(
      "p1",
      (packet) => sent.push(packet),
      () => 0,
    );
    t.receive(view());
    for (let i = 0; i < count; i++)
      t.frame({ ...EMPTY_INPUT, y: 1 }, delta, true);
    const packets = sent.length;
    const stopped = t.frame(EMPTY_INPUT, 200, true)!;
    return { packets, y: stopped.players[0].position.y };
  };
  const slow = run(100, 10),
    normal = run(1000 / 30, 30);
  expect(slow.packets).toBe(30);
  expect(slow.y).toBeCloseTo(normal.y, 1);
});

it("reliably transmits both press and release transitions, including optional item buttons", () => {
  for (const action of ["balloon", "useItem"] as const) {
    const pressed = { ...EMPTY_INPUT, [action]: true };
    expect(hasActionTransition(pressed, EMPTY_INPUT)).toBe(true);
    expect(hasActionTransition(EMPTY_INPUT, pressed)).toBe(true);
    expect(hasActionTransition(pressed, pressed)).toBe(false);
  }
  expect(hasActionTransition({ ...EMPTY_INPUT, y: 1 }, EMPTY_INPUT)).toBe(
    false,
  );
});

it("preserves fast Ctrl press-release-press transitions across 30Hz input sampling", () => {
  const packets: NetworkInput[] = [];
  const t = new OnlineTimeline(
    "p1",
    (p) => packets.push(p),
    () => 0,
  );
  t.receive(view());
  t.frame({ ...EMPTY_INPUT, useItem: true }, 10, true);
  t.frame(EMPTY_INPUT, 10, true);
  t.frame({ ...EMPTY_INPUT, useItem: true }, 10, true);
  t.frame(EMPTY_INPUT, 10, true);
  for (let i = 0; i < 4; i++) t.frame(EMPTY_INPUT, 34, true);
  expect(packets.slice(0, 4).map((p) => p.useItem)).toEqual([
    true,
    false,
    true,
    false,
  ]);
});

it("caps catch-up after a long frame and keeps every received snapshot immutable during prediction and replay", () => {
  const sent: NetworkInput[] = [];
  const t = new OnlineTimeline(
    "p1",
    (packet) => sent.push(packet),
    () => 0,
  );
  const snapshot = view(),
    before = structuredClone(snapshot);
  function freeze(value: unknown) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  }
  freeze(snapshot);
  t.receive(snapshot);
  t.frame({ ...EMPTY_INPUT, y: 1 }, 10000, true);
  expect(sent.length).toBeLessThanOrEqual(
    Math.ceil(C.maxFrameMs / (1000 / C.simulationHz)),
  );
  t.receive(snapshot);
  t.frame({ ...EMPTY_INPUT, x: 1 }, 34, true);
  expect(snapshot).toEqual(before);
});

it("keeps displayed local and remote corner corrections outside crates", () => {
  let now = 0;
  const t = new OnlineTimeline(
    "p1",
    () => {},
    () => now,
  );
  const a = view();
  a.game!.arenaId = "pirate-lion";
  a.game!.map.forEach((row) => row.fill("floor"));
  a.game!.map[5][3] = "crate";
  for (const p of a.game!.players) p.position = { x: 4.02, y: 4.51 };
  t.receive(a);
  t.frame(EMPTY_INPUT, 16, true);
  const b = structuredClone(a);
  b.tick = 1;
  for (const p of b.game!.players) p.position = { x: 4.5, y: 5.5 };
  now = 50;
  t.receive(b);
  now = 125;
  const shown = t.frame(EMPTY_INPUT, 16, true)!;
  for (const p of shown.players)
    expect(canOccupy(shown, p, p.position.x, p.position.y)).toBe(true);
});
