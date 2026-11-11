import { expect, it } from "vitest";
import {
  createArenaPractice,
  createPractice,
  movePlayer,
  canOccupy,
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
it("turns immediately at fractional positions in all four directions without diagonal motion", () => {
  for (const [x, y] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const { s, p } = fixture();
    p.position = { x: 4.63, y: 4.37 };
    p.moveTarget = { x: 5.5, y: 4.5 };
    const before = { ...p.position };
    movePlayer(s, p, { ...EMPTY_INPUT, x, y }, 16);
    expect(p.position.x).toBeCloseTo(before.x + x * 0.048);
    expect(p.position.y).toBeCloseTo(before.y + y * 0.048);
    expect(p.moveTarget).toBeUndefined();
  }
});
it("sanitizes simultaneous axis packets to one direction and ignores stale queued turns", () => {
  const { s, p } = fixture();
  p.facing = "right";
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1, y: 1, turn: "up", turnId: 20 }, 16);
  expect(p.position.x).toBeGreaterThan(4.5);
  expect(p.position.y).toBe(4.5);
  expect(p.queuedTurn).toBeUndefined();
  defeatPlayer(s, p);
  expect(p.moveTarget).toBeUndefined();
});
it("cannot tunnel through a wall even with a long high-speed step", () => {
  const { s, p } = fixture();
  p.speed = 6;
  s.map[4][5] = "wall";
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1 }, 1000);
  expect(p.position.x).toBeLessThanOrEqual(4.72);
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
it("nudges only sideways at a blocked open corner, with no simultaneous diagonal step", () => {
  for (const blocked of [false, true]) {
    const { s, p } = fixture();
    p.position = { x: 4.275, y: 4.28 };
    s.map[3][3] = "wall";
    if (blocked) s.map[3][4] = "wall";
    const before = { ...p.position };
    movePlayer(s, p, { ...EMPTY_INPUT, y: -1 }, 16);
    expect(p.position.y).toBe(before.y);
    expect(blocked ? p.position.x === before.x : p.position.x > before.x).toBe(
      true,
    );
    for (let i = 0; i < 20; i++) {
      const old = { ...p.position };
      movePlayer(s, p, { ...EMPTY_INPUT, y: -1 }, 16);
      expect(p.position.x === old.x || p.position.y === old.y).toBe(true);
    }
    expect(blocked ? p.position.y === before.y : p.position.y < before.y).toBe(
      true,
    );
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
it("resumes the held direction at the fractional position after releasing an overlapping key", () => {
  const { s, p } = fixture();
  movePlayer(s, p, { ...EMPTY_INPUT, y: 1 }, 100);
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1, turn: "right", turnId: 2 }, 16);
  const x = p.position.x,
    y = p.position.y;
  for (let i = 0; i < 43; i++)
    movePlayer(s, p, { ...EMPTY_INPUT, y: 1, turn: "right", turnId: 2 }, 16);
  expect(p.position.x).toBe(x);
  expect(p.position.y).toBeGreaterThan(y);
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

it("slides past shallow corner overlaps in every direction without diagonal motion or clipping", () => {
  for (const turns of [0, 1, 2, 3])
    for (const mirror of [false, true])
      for (const kind of ["wall", "crate", "balloon"] as const)
        for (const trapped of [false, true]) {
          const { s, p } = fixture();
          const rotate = (x: number, y: number) => {
            for (let i = 0; i < turns; i++) [x, y] = [9 - y, x];
            return { x, y };
          };
          const obstacle = rotate(mirror ? 5.5 : 3.5, 3.5);
          const cell = { x: Math.floor(obstacle.x), y: Math.floor(obstacle.y) };
          if (kind === "balloon")
            s.balloons.push({
              id: 1,
              owner: p.id,
              ...cell,
              range: 1,
              explodesAt: 2500,
              passThrough: [],
            });
          else s.map[cell.y][cell.x] = kind;
          p.position = rotate(mirror ? 4.87 : 4.13, 4.28);
          if (trapped) p.status = "trapped";
          const d = rotate(4.5, 3.5);
          const x = d.x - 4.5,
            y = d.y - 4.5;
          const start = { ...p.position };
          for (let i = 0; i < 50; i++) {
            const before = { ...p.position };
            movePlayer(s, p, { ...EMPTY_INPUT, x, y }, 16);
            expect(p.position.x === before.x || p.position.y === before.y).toBe(
              true,
            );
            expect(canOccupy(s, p, p.position.x, p.position.y)).toBe(true);
          }
          expect(
            (p.position.x - start.x) * x + (p.position.y - start.y) * y,
          ).toBeGreaterThan(0.25);
          expect(p.moving).toBe(true);
        }
});
it("does not assist a frontal wall, deep overlap, or a blocked sideways escape", () => {
  for (const reason of ["front", "deep", "side"]) {
    const { s, p } = fixture();
    s.map[3][3] = "wall";
    p.position = { x: reason === "deep" ? 4.05 : 4.13, y: 4.28 };
    if (reason === "front") s.map[3][4] = "wall";
    if (reason === "side")
      s.balloons.push({
        id: 1,
        owner: p.id,
        x: 4,
        y: 4,
        range: 1,
        explodesAt: 2500,
        passThrough: [],
      });
    const before = { ...p.position };
    for (let i = 0; i < 30; i++)
      movePlayer(s, p, { ...EMPTY_INPUT, y: -1 }, 16);
    expect(p.position).toEqual(before);
  }
});
