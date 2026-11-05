import { describe, expect, it } from "vitest";
import {
  GAME_CONFIG as C,
  createPractice,
  createSoloPractice,
  stepPractice,
  placeBalloon,
  EMPTY_INPUT as idle,
  canOccupy,
  type PracticeState,
  type LocalInput,
} from "./index";
const move = (x: number, y: number, balloon = false): LocalInput => ({
  x,
  y,
  balloon,
});

describe("solo practice", () => {
  it("has one player, no round timer and the two FIFO training items", () => {
    const s = createSoloPractice();
    expect(s.players).toHaveLength(1);
    expect(s.players[0].id).toBe("p1");
    expect(s.players[0].inventory).toEqual(["shield", "power"]);
    expect(s.round).toBeUndefined();
    stepPractice(s, [{ ...idle, useItem: true }], 20);
    expect(s.players[0].inventory).toEqual(["power"]);
    stepPractice(s, [idle], 20);
    stepPractice(s, [{ ...idle, useItem: true }], 20);
    expect(s.players[0].inventory).toEqual([]);
    expect(s.players[0].powerUntil).toBeGreaterThan(s.time);
    expect(createPractice().players).toHaveLength(2);
  });

  it("continues beyond online round duration and respawns the only player", () => {
    const s = createSoloPractice();
    stepPractice(s, [{ ...idle, balloon: true }], 20);
    for (let i = 0; i < 40; i++) stepPractice(s, [idle], 250);
    expect(s.players).toHaveLength(1);
    expect(s.players[0].deaths).toBe(1);
    expect(s.players[0].status).toBe("active");
    for (let i = 0; i < 720; i++) stepPractice(s, [idle], 250);
    expect(s.time).toBeGreaterThan(C.roundMs);
    expect(s.round).toBeUndefined();
    expect(s.players).toHaveLength(1);
  });
});
function openArena(seed = 1) {
  const s = createPractice(seed);
  s.map = s.map.map((row, y) =>
    row.map((_tile, x) =>
      x === 0 || y === 0 || x === 14 || y === 12 || x === 7 ? "wall" : "floor",
    ),
  );
  return s;
}
function step(
  s: PracticeState,
  ms: number,
  input: LocalInput = idle,
  p2: LocalInput = idle,
) {
  stepPractice(s, [input, p2], ms);
}

describe("local movement", () => {
  it("moves both players independently and stops immediately on key release", () => {
    const s = openArena();
    step(s, 200, move(1, 0), move(-1, 0));
    expect(s.players[0].position.x).toBeCloseTo(2.1);
    expect(s.players[1].position.x).toBeCloseTo(12.9);
    const before = { ...s.players[0].position };
    step(s, 200);
    expect(s.players[0].position).toEqual(before);
    expect(s.players[0].moving).toBe(false);
  });
  it("normalizes diagonal movement and clamps invalid inputs", () => {
    const s = openArena(),
      p = s.players[0];
    p.position = { x: 3.5, y: 3.5 };
    step(s, 200, move(1, 1));
    expect(Math.hypot(p.position.x - 3.5, p.position.y - 3.5)).toBeCloseTo(0.6);
    const before = { ...p.position };
    step(s, 100, move(NaN, Infinity));
    expect(p.position).toEqual(before);
  });
  it("blocks walls and crates without tunneling on a long frame", () => {
    const s = openArena(),
      p = s.players[0];
    s.map[1][3] = "crate";
    step(s, 2000, move(1, 0));
    expect(p.position.x).toBeLessThanOrEqual(3 - C.playerRadius);
    expect(canOccupy(s, p, p.position.x, p.position.y)).toBe(true);
    step(s, 2000, move(-1, 0));
    expect(p.position.x).toBeGreaterThanOrEqual(1 + C.playerRadius);
  });
  it("slides along obstacles and gently aligns an offset corridor turn", () => {
    const s = openArena(),
      p = s.players[0];
    s.map[2][2] = "wall";
    p.position = { x: 1.5, y: 1.725 };
    step(s, 600, move(1, 0));
    expect(p.position.y).toBeLessThan(1.725);
    expect(p.position.y).toBeGreaterThanOrEqual(1.5);
    expect(p.position.x).toBeGreaterThan(2.5);
    p.position = { x: 1.7, y: 2.5 };
    step(s, 200, move(1, 1));
    expect(p.position.x).toBeLessThanOrEqual(2 - C.playerRadius);
    expect(p.position.y).toBeGreaterThan(2.5);
  });
  it("produces the same state with different render frame sizes", () => {
    const a = openArena(),
      b = openArena();
    step(a, 1000, move(0, 1));
    for (let i = 0; i < 100; i++) step(b, 10, move(0, 1));
    expect(a.players).toEqual(b.players);
    expect(a.tick).toBe(b.tick);
  });
});

describe("balloons and blasts", () => {
  it("places once per press, enforces capacity and never stacks a tile", () => {
    const s = openArena(),
      p = s.players[0];
    step(s, 500, move(1, 0, true));
    expect(s.balloons).toHaveLength(1);
    expect(placeBalloon(s, p)).toBe(false);
    p.capacity = 3;
    expect(placeBalloon(s, p)).toBe(true);
    expect(placeBalloon(s, p)).toBe(false);
    step(s, 100, idle);
    step(s, 100, move(0, 0, true));
    expect(s.balloons).toHaveLength(2);
  });
  it("lets the owner leave but blocks reentry once the full body has left", () => {
    const s = openArena(),
      p = s.players[0];
    placeBalloon(s, p);
    step(s, 400, move(1, 0));
    expect(s.balloons[0].passThrough).not.toContain(p.id);
    step(s, 400, move(-1, 0));
    expect(p.position.x).toBeGreaterThanOrEqual(2 + C.playerRadius);
  });
  it("allows an occupant to escape even if already overlapping the adjacent balloon cell", () => {
    const s = openArena(),
      p = s.players[0];
    p.position.x = 1.95;
    placeBalloon(s, p);
    step(s, 400, move(1, 0));
    expect(p.position.x).toBeGreaterThan(3);
  });
  it("explodes at the fuse, respects walls and breaks only the first crate per ray", () => {
    const s = openArena(),
      p = s.players[0];
    p.position = { x: 3.5, y: 5.5 };
    p.range = 4;
    s.map[5][4] = "crate";
    s.map[5][5] = "crate";
    s.map[4][3] = "wall";
    placeBalloon(s, p);
    step(s, C.balloonFuseMs - C.fixedStepMs);
    expect(s.blasts).toHaveLength(0);
    step(s, C.fixedStepMs);
    expect(s.blasts).toHaveLength(1);
    expect(s.balloons).toHaveLength(0);
    expect(s.map[5][4]).toBe("floor");
    expect(s.map[5][5]).toBe("crate");
    expect(s.blasts[0].cells).not.toContainEqual({ x: 3, y: 4 });
    expect(s.blasts[0].cells).not.toContainEqual({ x: 5, y: 5 });
  });
  it("chains immediately and processes each balloon exactly once", () => {
    const s = openArena(),
      p = s.players[0];
    p.capacity = 3;
    p.range = 2;
    p.position = { x: 2.5, y: 5.5 };
    placeBalloon(s, p);
    p.position.x = 4.5;
    placeBalloon(s, p);
    s.balloons[1].explodesAt += 1000;
    step(s, C.balloonFuseMs);
    expect(s.balloons).toHaveLength(0);
    expect(s.blasts).toHaveLength(2);
    expect(new Set(s.blasts.map((b) => b.id)).size).toBe(2);
  });
  it("blocks a chain behind a wall and expires all blast damage", () => {
    const s = openArena(),
      p = s.players[0];
    p.capacity = 2;
    p.range = 3;
    p.position = { x: 2.5, y: 5.5 };
    placeBalloon(s, p);
    s.map[5][3] = "wall";
    p.position.x = 4.5;
    placeBalloon(s, p);
    s.balloons[1].explodesAt += 1000;
    step(s, C.balloonFuseMs);
    expect(s.balloons).toHaveLength(1);
    step(s, C.blastMs);
    expect(s.blasts).toHaveLength(0);
    expect(p.status).toBe("active");
  });
  it("does not pierce a crate when simultaneous blasts break it in the same tick", () => {
    const s = openArena(),
      p = s.players[0];
    p.capacity = 2;
    p.range = 3;
    p.position = { x: 2.5, y: 5.5 };
    placeBalloon(s, p);
    p.position = { x: 3.5, y: 4.5 };
    placeBalloon(s, p);
    s.map[5][3] = "crate";
    step(s, C.balloonFuseMs);
    expect(s.map[5][3]).toBe("floor");
    expect(s.blasts.find((b) => b.cells[0].x === 2)!.cells).not.toContainEqual({
      x: 4,
      y: 5,
    });
    expect(s.blasts.find((b) => b.cells[0].x === 3)!.cells).not.toContainEqual({
      x: 3,
      y: 6,
    });
  });
});

describe("damage, respawn and items", () => {
  it("traps once, freezes movement, then respawns with protection", () => {
    const s = openArena(),
      p = s.players[0];
    placeBalloon(s, p);
    step(s, C.balloonFuseMs);
    expect(p.status).toBe("trapped");
    const pos = { ...p.position };
    step(s, 500, move(0, 1));
    expect(p.position).toEqual(pos);
    step(s, C.trappedMs - 500 + C.respawnMs);
    expect(p.status).toBe("active");
    expect(p.deaths).toBe(1);
    expect(p.invulnerableUntil).toBeGreaterThan(s.time);
    s.blasts.push({
      id: 99,
      owner: "p2",
      cells: [{ x: 1, y: 1 }],
      expiresAt: s.time + 2000,
    });
    step(s, 100);
    expect(p.status).toBe("active");
    step(s, C.invulnerableMs);
    expect(p.status).toBe("trapped");
  });
  it("waits for a safe respawn cell instead of spawning inside a balloon or a blast", () => {
    const s = openArena(),
      p = s.players[0];
    p.status = "respawning";
    p.statusUntil = 0;
    s.map = s.map.map((row) => row.map(() => "wall"));
    step(s, 100);
    expect(p.status).toBe("respawning");
    s.map[1][1] = "floor";
    step(s, 100);
    expect(p.status).toBe("active");
  });
  it("applies all three item types, consumes once, and caps upgrades", () => {
    const s = openArena(),
      p = s.players[0];
    for (const kind of ["balloon", "range", "speed"] as const)
      for (let i = 0; i < 20; i++)
        s.items.push({ id: s.nextId++, kind, x: 1, y: 1, availableAt: 0 });
    step(s, 100);
    expect([p.capacity, p.range, p.speed]).toEqual([
      C.maxBalloons,
      C.maxRange,
      C.maxSpeed,
    ]);
    expect(s.items).toHaveLength(0);
    step(s, 100);
    expect(p.capacity).toBe(C.maxBalloons);
  });
  it("drops reproducible rewards from broken crates and delays pickup until water clears", () => {
    const a = openArena(1),
      b = openArena(1);
    for (const s of [a, b]) {
      s.players[0].position = { x: 3.5, y: 5.5 };
      s.map[5][4] = "crate";
      placeBalloon(s, s.players[0]);
      step(s, C.balloonFuseMs);
    }
    expect(a.items).toEqual(b.items);
    expect(a.items).toHaveLength(1);
    expect(a.items[0].availableAt).toBeGreaterThan(a.time);
  });
  it("does not award pickups to trapped players", () => {
    const s = openArena(),
      p = s.players[0];
    p.status = "trapped";
    p.statusUntil = 9999;
    s.items.push({ id: 99, kind: "range", x: 1, y: 1, availableAt: 0 });
    step(s, 100);
    expect(p.range).toBe(1);
    expect(s.items).toHaveLength(1);
  });
});
