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
it("finishes one tile after a short press and stops exactly at its center", () => {
  const { s, p } = fixture();
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1 }, 20);
  expect(p.position.x).toBeGreaterThan(4.5);
  for (let i = 0; i < 60; i++) movePlayer(s, p, EMPTY_INPUT, 16);
  expect(p.position).toEqual({ x: 5.5, y: 4.5 });
  expect(p.moveTarget).toBeUndefined();
});
it("turns at a tile center without diagonal drift and respects blocked tiles", () => {
  const { s, p } = fixture();
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1 }, 100);
  movePlayer(s, p, { ...EMPTY_INPUT, y: 1 }, 100);
  expect(p.position.y).toBe(4.5);
  movePlayer(s, p, { ...EMPTY_INPUT, y: 1 }, 200);
  expect(p.position.x).toBe(5.5);
  expect(p.position.y).toBeGreaterThan(4.5);
  for (let i = 0; i < 60; i++) movePlayer(s, p, EMPTY_INPUT, 16);
  s.map[6][5] = "wall";
  const before = { ...p.position };
  movePlayer(s, p, { ...EMPTY_INPUT, y: 1 }, 100);
  expect(p.position).toEqual(before);
});
it("records authoritative death origin and staggered flight times without granting airborne pickups", () => {
  const { s, p } = fixture();
  p.inventory = ["needle", "shield"];
  p.capacity = 3;
  const origin = { ...p.position };
  defeatPlayer(s, p);
  expect(s.items).toHaveLength(4);
  for (const item of s.items) {
    expect(item.flight!.from).toEqual(origin);
    expect(item.flight!.startedAt).toBe(s.time);
    expect(item.flight!.landsAt).toBeLessThan(item.availableAt);
    expect(s.map[item.y][item.x]).toBe("floor");
  }
  expect(new Set(s.items.map((i) => i.flight!.landsAt)).size).toBe(4);
  expect(p.inventory).toEqual([]);
});
it("remembers a quick overlapping turn until the next tile and then resumes the held direction", () => {
  const { s, p } = fixture();
  movePlayer(s, p, { ...EMPTY_INPUT, y: 1, turn: "down", turnId: 1 }, 100);
  movePlayer(s, p, { ...EMPTY_INPUT, x: 1, turn: "right", turnId: 2 }, 16);
  const held = { ...EMPTY_INPUT, y: 1, turn: "right" as const, turnId: 2 };
  for (let i = 0; i < 43; i++) movePlayer(s, p, held, 16);
  expect(p.position.x).toBe(5.5);
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
