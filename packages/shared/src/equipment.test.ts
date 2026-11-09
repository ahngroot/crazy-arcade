import { expect, it } from "vitest";
import {
  createSoloPractice,
  stepPractice,
  EMPTY_INPUT,
  GAME_CONFIG as C,
  collectItem,
  effectiveStats,
  placeBalloon,
  movePlayer,
} from "./index";

it("allows exactly five seconds of trapped movement at 40% base speed without balloons or item pickup", () => {
  const s = createSoloPractice(),
    p = s.players[0];
  s.map = s.map.map((row, y) =>
    row.map((_, x) => (x && y && x < 14 && y < 12 ? "floor" : "wall")),
  );
  p.status = "trapped";
  p.statusUntil = 5000;
  p.speed = C.maxSpeed;
  s.items.push({ id: 99, kind: "ghost", x: 1, y: 1, availableAt: 0 });
  stepPractice(s, [{ x: 1, y: 0, balloon: true }], 1000);
  expect(p.position.x).toBeCloseTo(2.7);
  expect(p.inventory).toEqual([]);
  expect(s.balloons).toHaveLength(0);
  stepPractice(s, [EMPTY_INPUT], 3980);
  expect(p.status).toBe("trapped");
  stepPractice(s, [EMPTY_INPUT], 20);
  expect(p.status).toBe("respawning");
  expect(p.deaths).toBe(1);
  stepPractice(s, [EMPTY_INPUT], C.respawnMs);
  expect(p.status).toBe("active");
});

it("activates ultra, glove, shoes and ghost through the same two-slot FIFO inventory", () => {
  for (const kind of ["ultra", "glove", "shoes", "ghost"] as const) {
    const s = createSoloPractice(),
      p = s.players[0];
    expect(collectItem(p, kind)).toBe(true);
    stepPractice(s, [{ ...EMPTY_INPUT, useItem: true }], C.fixedStepMs);
    expect(p.inventory).toEqual([]);
    expect(p[`${kind}Until`]).toBeGreaterThan(s.time);
    if (kind === "ultra") expect(effectiveStats(s, p).range).toBe(C.maxRange);
    stepPractice(s, [EMPTY_INPUT], C.powerMs + 20);
    expect(p[`${kind}Until`]).toBeLessThan(s.time);
  }
});

it("shoes push one tile and gloves throw two tiles, retaining fuse and owner; prediction cannot move balloons", () => {
  for (const kind of ["shoes", "glove"] as const) {
    const s = createSoloPractice(),
      p = s.players[0];
    s.map[1].fill("floor", 1, 14);
    p.position = { x: 2.5, y: 1.5 };
    placeBalloon(s, p);
    const b = s.balloons[0];
    b.passThrough = [];
    p.position.x = 1.7;
    p[`${kind}Until`] = 6000;
    movePlayer(s, p, { x: 1, y: 0, balloon: false }, 100, false);
    expect(b.x).toBe(2);
    movePlayer(s, p, { x: 1, y: 0, balloon: false }, 100);
    expect(b.x).toBe(kind === "glove" ? 4 : 3);
    expect(b.explodesAt).toBe(C.balloonFuseMs);
    expect(b.owner).toBe(p.id);
  }
});
