import { expect, it } from "vitest";
import {
  createArenaPractice,
  createPractice,
  movePlayer,
  defeatPlayer,
  EMPTY_INPUT,
} from "./index";
function fixture() {
  const s = createArenaPractice(1);
  s.map = s.map.map((row) => row.map(() => "floor"));
  const p = s.players[0];
  p.position = { x: 4.5, y: 4.5 };
  return { s, p };
}
it("assists an open corner near the center without diagonal cutting or crossing walls", () => {
  for (const blocked of [false, true]) {
    const { s, p } = fixture();
    p.position = { x: 4.32, y: 4.5 };
    p.moveTarget = { x: 4.5, y: 4.5 };
    p.facing = "right";
    if (blocked) s.map[3][4] = "wall";
    movePlayer(s, p, { ...EMPTY_INPUT, y: -1 }, 20);
    expect(p.position.y).toBe(4.5);
    expect(p.position.x).toBeCloseTo(blocked ? 4.38 : 4.416);
    for (let i = 0; i < 20; i++)
      movePlayer(s, p, { ...EMPTY_INPUT, y: -1 }, 16);
    expect(p.position.x).toBe(4.5);
    expect(blocked ? p.position.y === 4.5 : p.position.y < 4.5).toBe(true);
  }
});
it("expires an old quick turn without rearming the same input ID", () => {
  const { s, p } = fixture();
  p.status = "trapped";
  movePlayer(s, p, { ...EMPTY_INPUT, y: 1 }, 100);
  const held = { ...EMPTY_INPUT, y: 1, turn: "right" as const, turnId: 20 };
  movePlayer(s, p, held, 16);
  expect(p.queuedTurn).toBe("right");
  for (let i = 0; i < 140; i++) movePlayer(s, p, held, 16);
  expect(p.queuedTurn).toBeUndefined();
  expect(p.position.x).toBe(4.5);
  expect(p.position.y).toBeGreaterThan(5.5);
});
it("uses the newest buffered direction and clears it on death", () => {
  const { s, p } = fixture();
  movePlayer(s, p, { ...EMPTY_INPUT, y: 1 }, 100);
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1, turn: "right", turnId: 1 }, 16);
  movePlayer(s, p, { ...EMPTY_INPUT, x: -1, turn: "left", turnId: 2 }, 16);
  for (let i = 0; i < 25; i++) movePlayer(s, p, { ...EMPTY_INPUT, x: -1 }, 16);
  expect(p.position.x).toBeLessThan(4.5);
  expect(p.position.y).toBe(4.5);
  p.queuedTurn = "up";
  p.queuedTurnRemainingMs = 300;
  defeatPlayer(s, p);
  expect(p.queuedTurn).toBeUndefined();
  expect(p.queuedTurnRemainingMs).toBeUndefined();
});
it("walks toward blocked walls in all directions without displacement and stops on release", () => {
  for (const themed of [true, false]) {
    const s = themed ? fixture().s : createPractice();
    s.map = s.map.map((row) => row.map(() => "floor"));
    const p = s.players[0];
    p.position = { x: 4.5, y: 4.5 };
    s.map[4][3] = s.map[4][5] = s.map[3][4] = s.map[5][4] = "wall";
    for (const [x, y, facing] of [
      [1, 0, "right"],
      [-1, 0, "left"],
      [0, -1, "up"],
      [0, 1, "down"],
    ] as const) {
      for (let i = 0; i < 60; i++)
        movePlayer(s, p, { ...EMPTY_INPUT, x, y }, 16);
      const blocked = { ...p.position };
      for (let i = 0; i < 10; i++) {
        movePlayer(s, p, { ...EMPTY_INPUT, x, y }, 16);
        expect(p.moving).toBe(true);
        expect(p.facing).toBe(facing);
        expect(p.position).toEqual(blocked);
      }
      expect(s.map[Math.floor(p.position.y)][Math.floor(p.position.x)]).toBe(
        "floor",
      );
      movePlayer(s, p, EMPTY_INPUT, 16);
      expect(p.moving).toBe(false);
      expect(p.facing).toBe(facing);
    }
  }
});
it("stops immediately and resumes from the same fractional position", () => {
  for (const [x, y] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const { s, p } = fixture();
    movePlayer(s, p, { ...EMPTY_INPUT, x, y }, 100);
    const stopped = { ...p.position };
    for (let i = 0; i < 60; i++) movePlayer(s, p, EMPTY_INPUT, 16);
    expect(p.position).toEqual(stopped);
    expect(p.moving).toBe(false);
    movePlayer(s, p, { ...EMPTY_INPUT, x, y }, 16);
    expect(
      (p.position.x - stopped.x) * x + (p.position.y - stopped.y) * y,
    ).toBeGreaterThan(0);
  }
});
it("aligns to the nearer open lane after a mid-tile stop without diagonal drift", () => {
  for (const blocked of [false, true]) {
    const { s, p } = fixture();
    movePlayer(s, p, { ...EMPTY_INPUT, x: 1 }, 60);
    movePlayer(s, p, EMPTY_INPUT, 16);
    if (blocked) s.map[3][4] = "wall";
    movePlayer(s, p, { ...EMPTY_INPUT, y: -1 }, 16);
    expect(p.position.y).toBe(4.5);
    expect(blocked ? p.position.x > 4.68 : p.position.x < 4.68).toBe(true);
    for (let i = 0; i < 40; i++)
      movePlayer(s, p, { ...EMPTY_INPUT, y: -1 }, 16);
    expect(p.position.x).toBe(blocked ? 5.5 : 4.5);
    expect(p.position.y).toBeLessThan(4.5);
  }
});
it("records authoritative death origin and staggered flight times without granting airborne pickups", () => {
  const { s, p } = fixture();
  p.inventory = ["needle", "shield"];
  p.capacity = 3;
  const origin = { ...p.position };
  defeatPlayer(s, p);
  expect(s.items).toHaveLength(3);
  for (const item of s.items) {
    expect(item.flight!.from).toEqual(origin);
    expect(item.flight!.startedAt).toBe(s.time);
    expect(item.flight!.landsAt).toBeLessThan(item.availableAt);
    expect(s.map[item.y][item.x]).toBe("floor");
  }
  expect(new Set(s.items.map((i) => i.flight!.landsAt)).size).toBe(3);
  expect(p.inventory).toEqual([]);
});
it("returns to the nearby lane when a quick turn is released back to the held direction", () => {
  const { s, p } = fixture();
  movePlayer(s, p, { ...EMPTY_INPUT, y: 1, turn: "down", turnId: 1 }, 100);
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1, turn: "right", turnId: 2 }, 16);
  const held = { ...EMPTY_INPUT, y: 1, turn: "right" as const, turnId: 2 };
  for (let i = 0; i < 43; i++) movePlayer(s, p, held, 16);
  expect(p.position.x).toBe(4.5);
  expect(p.position.y).toBeGreaterThan(5.5);
  const x = p.position.x;
  for (let i = 0; i < 25; i++) movePlayer(s, p, held, 16);
  expect(p.position.x).toBe(x);
  expect(p.position.y).toBeGreaterThan(6.5);
});
it("does not let a blocked overlapping turn lock the held direction", () => {
  const { s, p } = fixture();
  s.map[5][5] = "wall";
  movePlayer(s, p, { ...EMPTY_INPUT, y: 1 }, 100);
  for (let i = 0; i < 50; i++)
    movePlayer(s, p, { ...EMPTY_INPUT, y: 1, turn: "right", turnId: 9 }, 16);
  expect(p.position.x).toBe(4.5);
  expect(p.position.y).toBeGreaterThan(6.5);
});

it("reverses immediately in all directions before and after the midpoint, then stops immediately on release", () => {
  for (const [x, y] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    for (const elapsed of [60, 240]) {
      const { s, p } = fixture();
      movePlayer(s, p, { ...EMPTY_INPUT, x, y }, elapsed);
      const before = { ...p.position };
      movePlayer(s, p, { ...EMPTY_INPUT, x: -x, y: -y }, 16);
      expect(
        (p.position.x - before.x) * x + (p.position.y - before.y) * y,
      ).toBeLessThan(0);
      const stopped = { ...p.position };
      for (let i = 0; i < 80; i++) movePlayer(s, p, EMPTY_INPUT, 16);
      expect(p.position).toEqual(stopped);
    }
});
it("consumes a quick reverse once, continues when held, and can reverse again", () => {
  const { s, p } = fixture();
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1, turn: "right", turnId: 1 }, 240);
  movePlayer(s, p, { ...EMPTY_INPUT, x: -1, turn: "left", turnId: 2 }, 16);
  const before = p.position.x;
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1, turn: "right", turnId: 3 }, 16);
  expect(p.position.x).toBeGreaterThan(before);
  movePlayer(s, p, { ...EMPTY_INPUT, x: -1, turn: "left", turnId: 4 }, 16);
  for (let i = 0; i < 60; i++)
    movePlayer(s, p, { ...EMPTY_INPUT, x: -1, turn: "left", turnId: 4 }, 16);
  expect(p.position.x).toBeLessThan(4.5);
});
it("does not reverse through a balloon after its pass-through permission is lost", () => {
  const { s, p } = fixture();
  s.balloons.push({
    id: 1,
    owner: p.id,
    x: 4,
    y: 4,
    range: 1,
    explodesAt: 2500,
    passThrough: [p.id],
  });
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1 }, 300);
  s.balloons[0].passThrough = [];
  for (let i = 0; i < 80; i++) movePlayer(s, p, { ...EMPTY_INPUT, x: -1 }, 16);
  expect(p.position.x).toBeGreaterThanOrEqual(5.28);
});
