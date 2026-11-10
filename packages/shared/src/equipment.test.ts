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

it("allows exactly five seconds of trapped movement at 20% base speed without balloons or item pickup", () => {
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
  expect(p.position.x).toBeCloseTo(2.1);
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

it("retains the dormant equipment implementation for future testing", () => {
  for (const kind of ["glove", "shoes", "ghost"] as const) {
    const s = createSoloPractice(),
      p = s.players[0];
    expect(collectItem(p, kind)).toBe(true);
    stepPractice(s, [{ ...EMPTY_INPUT, useItem: true }], C.fixedStepMs);
    expect(p.inventory).toEqual([]);
    expect(p[`${kind}Until`]).toBeGreaterThan(s.time);
    stepPractice(s, [EMPTY_INPUT], C.powerMs + 20);
    expect(p[`${kind}Until`]).toBeLessThan(s.time);
  }
});

it("applies fluid, roller and ultra immediately even with a full inventory, without expiring or consuming Ctrl", () => {
  const s = createSoloPractice(),
    p = s.players[0];
  p.inventory = ["needle", "shield"];
  collectItem(p, "range");
  expect(p.range).toBe(C.initialRange + 1);
  collectItem(p, "speed");
  expect(p.speed).toBe(C.movementTilesPerSecond + C.speedIncrement);
  collectItem(p, "ultra");
  expect(effectiveStats(s, p).range).toBe(C.maxRange);
  expect(p.inventory).toEqual(["needle", "shield"]);
  stepPractice(s, [EMPTY_INPUT], C.powerMs + 20);
  expect(effectiveStats(s, p).range).toBe(C.maxRange);
  expect(p.inventory).toEqual(["needle", "shield"]);
});

it("only drops enabled test items and collects ultra immediately through the simulation", () => {
  const dropped = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) {
    const s = createSoloPractice(seed),
      p = s.players[0];
    s.map[1][2] = "crate";
    placeBalloon(s, p);
    s.balloons[0].explodesAt = 0;
    stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
    for (const item of s.items) {
      expect([
        "balloon",
        "range",
        "speed",
        "ultra",
        "needle",
        "shield",
      ]).toContain(item.kind);
      dropped.add(item.kind);
    }
  }
  expect(dropped).toEqual(
    new Set(["balloon", "range", "speed", "ultra", "needle", "shield"]),
  );
  const s = createSoloPractice(),
    p = s.players[0];
  p.inventory = ["needle", "shield"];
  s.items.push({ id: 99, kind: "ultra", x: 1, y: 1, availableAt: 0 });
  stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
  expect(s.items).toHaveLength(0);
  expect(p.range).toBe(C.maxRange);
  expect(p.inventory).toEqual(["needle", "shield"]);
});

it("stores picked-up needle and shield without activation, then consumes each only on its valid Ctrl edge", () => {
  const s = createSoloPractice(),
    p = s.players[0];
  for (const kind of ["needle", "shield"] as const)
    s.items.push({ id: s.nextId++, kind, x: 1, y: 1, availableAt: 0 });
  stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
  expect(p.inventory).toEqual(["needle", "shield"]);
  expect(p.shieldUntil).toBe(0);
  const ctrl = { ...EMPTY_INPUT, useItem: true };
  stepPractice(s, [ctrl], C.fixedStepMs);
  expect(p.inventory).toEqual(["needle", "shield"]);
  stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
  p.status = "trapped";
  p.statusUntil = s.time + C.trappedMs;
  stepPractice(s, [ctrl], C.fixedStepMs);
  expect(p.status).toBe("active");
  expect(p.inventory).toEqual(["shield"]);
  expect(p.shieldUntil).toBe(0);
  stepPractice(s, [ctrl], C.fixedStepMs);
  expect(p.inventory).toEqual(["shield"]);
  stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
  stepPractice(s, [ctrl], C.fixedStepMs);
  expect(p.inventory).toEqual([]);
  expect(p.shieldUntil - s.time).toBeCloseTo(C.shieldMs);
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
