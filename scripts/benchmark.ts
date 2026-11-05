import { performance } from "node:perf_hooks";
import {
  createCompetition,
  stepPractice,
  EMPTY_INPUT,
  GAME_CONFIG as C,
} from "@bubble/shared";
import { RoomService } from "../apps/server/src/rooms";
import { OnlineTimeline } from "../apps/client/src/netcode";

const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * p))
  ] ?? 0;
function simulation() {
  const state = createCompetition(2701);
  const durations: number[] = [];
  let maxPopulation = 0;
  const start = performance.now();
  for (let i = 0; i < 5400; i++) {
    const at = performance.now();
    stepPractice(state, [EMPTY_INPUT, EMPTY_INPUT], 1000 / 30);
    durations.push(performance.now() - at);
    maxPopulation = Math.max(maxPopulation, state.round!.monsters.length);
  }
  return {
    simulatedSeconds: state.time / 1000,
    totalWallMs: performance.now() - start,
    p95TickMs: percentile(durations, 0.95),
    maxPopulation,
    snapshotBytes: Buffer.byteLength(JSON.stringify(state)),
  };
}
function rooms() {
  let now = 1000;
  const service = new RoomService(() => now),
    durations: number[] = [];
  global.gc?.();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 20; i++) {
    const a = service.create(`a${i}`, `ip${i}`, {
      nickname: "A",
      durationMs: C.roundMs,
    });
    if (!a.ok) throw Error(a.error);
    const b = service.join(`b${i}`, `ip${i}`, {
      nickname: "B",
      code: a.room.code,
    });
    if (!b.ok) throw Error(b.error);
    service.ready(`a${i}`, true);
    service.ready(`b${i}`, true);
  }
  now += C.countdownMs + 1;
  service.advance();
  for (const room of service.rooms.values())
    room.game = createCompetition(2701);
  const start = performance.now();
  let nextSnapshot = now;
  for (let i = 0; i < 5400; i++) {
    now += 1000 / 30;
    const at = performance.now();
    service.advance();
    if (now >= nextSnapshot) {
      service.broadcasts();
      nextSnapshot += 1000 / C.snapshotHz;
    }
    durations.push(performance.now() - at);
  }
  const time = performance.now() - start;
  for (let i = 0; i < 20; i++) {
    service.leave(`a${i}`);
    service.leave(`b${i}`);
  }
  now += C.emptyRoomTtlMs + 1000;
  service.advance();
  global.gc?.();
  return {
    rooms: 20,
    totalWallMs: time,
    p95TickMs: percentile(durations, 0.95),
    p99TickMs: percentile(durations, 0.99),
    afterCleanup: service.diagnostics(),
    postGcHeapDeltaMiB: global.gc
      ? (process.memoryUsage().heapUsed - before) / 1024 / 1024
      : null,
  };
}
function prediction() {
  let now = 1000;
  const service = new RoomService(() => now);
  service.create("a", "ip", { nickname: "A", durationMs: C.roundMs });
  const initial = service.current("a")!;
  initial.game = createCompetition(2701);
  initial.phase = "PLAYING";
  stepPractice(initial.game, [EMPTY_INPUT, EMPTY_INPUT], 150_000);
  const t = new OnlineTimeline(
      "p1",
      () => {},
      () => now,
    ),
    times: number[] = [];
  const start = performance.now();
  for (let i = 0; i < 3000; i++) {
    now += 50;
    const packet = structuredClone(initial);
    packet.tick = i;
    const at = performance.now();
    t.receive(packet);
    t.frame(EMPTY_INPUT, 50, true);
    times.push(performance.now() - at);
  }
  return {
    latePopulation: initial.game.round!.monsters.length,
    frames: 3000,
    totalWallMs: performance.now() - start,
    p95ReceiveAndFrameMs: percentile(times, 0.95),
  };
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      simulation: simulation(),
      rooms: rooms(),
      prediction: prediction(),
    },
    null,
    2,
  ),
);
