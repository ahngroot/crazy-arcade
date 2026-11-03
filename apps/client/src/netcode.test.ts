import { it, expect } from "vitest";
import {
  createCompetition,
  GAME_CONFIG as C,
  EMPTY_INPUT,
  type RoomView,
  type NetworkInput,
} from "@bubble/shared";
import { OnlineTimeline } from "./netcode";
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
    [{ x: 0, y: 1, balloon: true }, EMPTY_INPUT],
    34,
    true,
  )!;
  expect(result.players[0].position.y).toBeGreaterThan(1.5);
  expect(result.balloons).toHaveLength(0);
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
  t.frame([{ x: 0, y: 1, balloon: false }, EMPTY_INPUT], 34, true);
  const b = view();
  b.tick = 2;
  b.players[0].ack = 1;
  b.game!.players[0].position.y = 1.6;
  t.receive(b);
  expect(t.view?.tick).toBe(2);
  t.receive(a);
  expect(t.view?.tick).toBe(2);
  t.frame([EMPTY_INPUT, EMPTY_INPUT], 100, false);
  expect(sent).toHaveLength(1);
  b.paused = true;
  t.receive(b);
  t.frame([EMPTY_INPUT, EMPTY_INPUT], 100, true);
  expect(sent).toHaveLength(1);
  t.resetConnection();
  expect(() => t.frame([EMPTY_INPUT, EMPTY_INPUT], 100, false)).not.toThrow();
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
  const result = t.frame([EMPTY_INPUT, EMPTY_INPUT], 34, true)!;
  expect(result.players[1].position.y).toBeCloseTo(2);
  const c = view();
  c.roundId = 2;
  now = 200;
  t.receive(c);
  t.frame([EMPTY_INPUT, EMPTY_INPUT], 34, true);
  expect(sent.at(-1)?.sequence).toBe(1);
});
