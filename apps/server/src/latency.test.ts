import { it, expect } from "vitest";
import {
  EMPTY_INPUT,
  GAME_CONFIG as C,
  type NetworkInput,
  type RoomView,
} from "@bubble/shared";
import { OnlineTimeline } from "../../client/src/netcode";
import { RoomService } from "./rooms";

it.each([60, 10])(
  "reconciles movement at %i render FPS with 180ms each-way delay, jitter and stale packets",
  (fps) => {
    let now = 1000;
    const service = new RoomService(() => now);
    const created = service.create("a", "ip", {
      nickname: "A",
      durationMs: 30000,
    });
    if (!created.ok) throw Error(created.error);
    service.join("b", "ip", { nickname: "B", code: created.room.code });
    service.ready("a", true);
    service.ready("b", true);
    now += C.countdownMs + 1;
    service.advance();
    const game = service.current("a")!.game!;
    game.map = game.map.map((row, y) =>
      row.map((_, x) =>
        x === 0 || x === 7 || x === 14 || y === 0 || y === 12
          ? "wall"
          : "floor",
      ),
    );
    game.round!.monsters = [];
    game.round!.nextSpawnAt = 1e9;
    game.round!.nextSpawnCheckAt = 1e9;
    const inputQueue: { at: number; packet: NetworkInput }[] = [],
      snapshots: { at: number; view: RoomView }[] = [];
    const t = new OnlineTimeline(
      "p1",
      (packet) => {
        inputQueue.push({
          at: now + 180 + ((packet.sequence % 5) - 2) * 20,
          packet,
        });
        if (packet.sequence % 7 === 0)
          inputQueue.push({ at: now + 300, packet });
      },
      () => now,
    );
    t.receive(structuredClone(service.current("a")!));
    const start = now;
    let nextFrame = start,
      nextTick = start,
      nextSnapshot = start;
    let result = game,
      maxError = 0;
    for (let i = 0; i < 480; i++) {
      now = start + (i * 1000) / 120;
      for (let j = inputQueue.length - 1; j >= 0; j--)
        if (inputQueue[j].at <= now) {
          service.input("a", inputQueue[j].packet);
          inputQueue.splice(j, 1);
        }
      if (now + 1e-7 >= nextTick) {
        service.advance();
        nextTick += 1000 / C.simulationHz;
      }
      if (now + 1e-7 >= nextSnapshot) {
        const v = structuredClone(service.current("a")!);
        snapshots.push({ at: now + 180 + ((v.tick % 5) - 2) * 20, view: v });
        nextSnapshot += 1000 / C.snapshotHz;
      }
      for (let j = snapshots.length - 1; j >= 0; j--)
        if (snapshots[j].at <= now) {
          t.receive(snapshots[j].view);
          snapshots.splice(j, 1);
        }
      if (now + 1e-7 >= nextFrame) {
        const input = { ...EMPTY_INPUT, y: now - start < 1000 ? 1 : 0 };
        result = t.frame(input, 1000 / fps, true)!;
        nextFrame += 1000 / fps;
        maxError = Math.max(
          maxError,
          Math.abs(result.players[0].position.y - game.players[0].position.y),
        );
        expect(result.players[0].score).toBe(game.players[0].score);
      }
    }
    expect(maxError).toBeLessThan(1.5);
    expect(result.players[0].position.y).toBeCloseTo(
      game.players[0].position.y,
      2,
    );
    expect(game.players[0].position.y).toBeGreaterThan(3.5);
    expect(game.players[0].position.y).toBeLessThan(5.5);
  },
);
