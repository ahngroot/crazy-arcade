import { expect, it } from "vitest";
import {
  ARENAS,
  createArenaMap,
  arenaSpawnCells,
  reachableArenaCells,
  createArenaPractice,
  createCompetition,
  canOccupy,
  movePlayer,
  defeatPlayer,
  stepPractice,
  EMPTY_INPUT,
  GAME_CONFIG as C,
} from "./index";

it("has seven extensible 15x13 themed layouts with floor, fixed obstacles and destructible objects", () => {
  expect(ARENAS).toHaveLength(7);
  expect(new Set(ARENAS.map((a) => a.id)).size).toBe(7);
  for (const arena of ARENAS) {
    const map = createArenaMap(arena);
    expect(map).toHaveLength(C.rows);
    expect(map.every((row) => row.length === C.columns)).toBe(true);
    for (const tile of ["floor", "wall", "crate"])
      expect(map.flat()).toContain(tile);
    expect(arenaSpawnCells(map).length).toBeGreaterThanOrEqual(4);
  }
});
it("starts both players on separate, movable empty tiles in the same eventual reachable region for every map and many seeds", () => {
  for (const arena of ARENAS)
    for (let seed = 1; seed <= 64; seed++) {
      const s = createCompetition(Math.imul(seed, 7919) >>> 0, C.roundMs, {
        id: arena.id,
      });
      const [a, b] = s.players;
      expect(
        Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y),
      ).toBeGreaterThanOrEqual(C.arenaSpawnMinDistance);
      const component = reachableArenaCells(s.map, a.position);
      for (const p of s.players) {
        const x = Math.floor(p.position.x),
          y = Math.floor(p.position.y);
        expect(s.map[y][x]).toBe("floor");
        expect(canOccupy(s, p, p.position.x, p.position.y)).toBe(true);
        expect(component.has(`${x},${y}`)).toBe(true);
        expect(p.position).toEqual(p.spawn);
        expect([p.capacity, p.range, p.speed]).toEqual([
          C.initialBalloons,
          C.initialRange,
          C.movementTilesPerSecond,
        ]);
        expect(p.inventory).toEqual([]);
        const direction = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].find(([dx, dy]) => s.map[y + dy]?.[x + dx] === "floor")!;
        movePlayer(
          s,
          p,
          { x: direction[0], y: direction[1], balloon: false },
          C.fixedStepMs,
        );
        expect(p.moving).toBe(true);
      }
    }
});
it("uses shared seed randomness, covers the whole catalogue and avoids repeating the previous map", () => {
  const ids = new Set<string>();
  let previous: string | undefined;
  for (let n = 0; n < 128; n++) {
    const seed = Math.imul(n + 1, 0x9e3779b9) >>> 0;
    const a = createArenaPractice(seed, previous),
      b = createArenaPractice(seed, previous);
    expect(a).toEqual(b);
    expect(a.arenaId).not.toBe(previous);
    ids.add(a.arenaId!);
    previous = a.arenaId;
  }
  expect(ids.size).toBe(ARENAS.length);
});
it("varies spawn positions within each layout without mutating registry data", () => {
  const source = JSON.stringify(ARENAS);
  for (const arena of ARENAS) {
    const positions = new Set<string>();
    for (let n = 1; n < 50; n++) {
      const s = createArenaPractice(
        Math.imul(n, 0x9e3779b9) >>> 0,
        undefined,
        arena.id,
      );
      positions.add(JSON.stringify(s.players[0].position));
      s.map[0][0] = "floor";
    }
    expect(positions.size).toBeGreaterThanOrEqual(
      Math.min(5, arenaSpawnCells(createArenaMap(arena)).length),
    );
  }
  expect(JSON.stringify(ARENAS)).toBe(source);
});
it("keeps online monsters on walkable tiles and away from all random initial player positions", () => {
  for (const arena of ARENAS) {
    const s = createCompetition(38459, C.roundMs, { id: arena.id });
    for (const m of s.round!.monsters) {
      expect(s.map[Math.floor(m.position.y)][Math.floor(m.position.x)]).toBe(
        "floor",
      );
      for (const p of s.players)
        expect(
          Math.hypot(m.position.x - p.position.x, m.position.y - p.position.y),
        ).toBeGreaterThanOrEqual(C.monsterSpawnSafeDistance);
    }
    stepPractice(s, [EMPTY_INPUT, EMPTY_INPUT], 5000);
    for (const m of s.round!.monsters)
      expect(s.map[Math.floor(m.position.y)][Math.floor(m.position.x)]).toBe(
        "floor",
      );
  }
});
it("retains the selected arena on death and respawns at base stats on a safe floor", () => {
  for (const arena of ARENAS) {
    const s = createArenaPractice(81234, undefined, arena.id),
      p = s.players[0];
    p.inventory = ["shield", "needle"];
    p.capacity = 3;
    p.speed = 4;
    p.range = 6;
    defeatPlayer(s, p);
    stepPractice(s, [EMPTY_INPUT], C.respawnMs);
    expect(s.arenaId).toBe(arena.id);
    expect(p.status).toBe("active");
    expect(s.map[Math.floor(p.position.y)][Math.floor(p.position.x)]).toBe(
      "floor",
    );
    expect([p.capacity, p.range, p.speed]).toEqual([
      C.initialBalloons,
      C.initialRange,
      C.movementTilesPerSecond,
    ]);
    expect(p.inventory).toEqual([]);
  }
});

it("rejects tiny pockets and trapped corridor middles, but accepts straight and bent escape routes", () => {
  const cells = (rows: string[]) =>
    arenaSpawnCells(
      rows.map((row) =>
        [...row].map((c) =>
          c === "." ? "floor" : c === "b" ? "crate" : "wall",
        ),
      ),
    );
  expect(cells(["wwwww", "w..ww", "wwwww"])).toEqual([]);
  expect(cells(["wwwww", "w.b.w", "wwwww"])).toEqual([]);
  expect(cells(["wwwww", "w...w", "wwwww"])).toEqual([
    { x: 1.5, y: 1.5 },
    { x: 3.5, y: 1.5 },
  ]);
  expect(cells(["wwww", "w..w", "ww.w", "wwww"])).toEqual([
    { x: 1.5, y: 1.5 },
    { x: 2.5, y: 2.5 },
  ]);
  expect(cells(["www", "w.w", "w.w", "w.w", "www"])).toHaveLength(2);
});

it("gives every selectable start a floor-only escape within four steps on all seven maps", () => {
  for (const arena of ARENAS) {
    const map = createArenaMap(arena);
    for (const start of arenaSpawnCells(map)) {
      const x = Math.floor(start.x),
        y = Math.floor(start.y);
      const queue = [{ x, y, depth: 0 }];
      const seen = new Set([`${x},${y}`]);
      let safe = false;
      for (const p of queue) {
        if (
          p.depth >= 2 &&
          !(
            (p.x === x && Math.abs(p.y - y) <= C.initialRange) ||
            (p.y === y && Math.abs(p.x - x) <= C.initialRange)
          )
        )
          safe = true;
        if (p.depth === 4) continue;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = p.x + dx,
            ny = p.y + dy,
            key = `${nx},${ny}`;
          if (map[ny]?.[nx] !== "floor" || seen.has(key)) continue;
          seen.add(key);
          queue.push({ x: nx, y: ny, depth: p.depth + 1 });
        }
      }
      expect(safe, `${arena.id}: ${x},${y}`).toBe(true);
    }
  }
});

it("keeps only the mast's three base tiles solid and allows walking behind its artwork", () => {
  const s = createArenaPractice(42, undefined, "pirate-mast"),
    p = s.players[0];
  const arena = ARENAS.find((a) => a.id === "pirate-mast")!;
  const base: string[] = [];
  arena.rows.forEach((row, y) =>
    [...row].forEach((glyph, x) => {
      if (glyph === "m") base.push(`${x},${y}`);
    }),
  );
  expect(base).toEqual(["6,6", "7,6", "8,6"]);
  for (const [x, y] of [
    [7, 3],
    [7, 4],
    [6, 5],
    [7, 5],
    [8, 5],
  ]) {
    expect(s.map[y][x]).toBe("floor");
    expect(canOccupy(s, p, x + 0.5, y + 0.5)).toBe(true);
  }
  for (const x of [6, 7, 8]) expect(canOccupy(s, p, x + 0.5, 6.5)).toBe(false);
  p.position = { x: 7.5, y: 3.5 };
  for (let i = 0; i < 60; i++) movePlayer(s, p, { ...EMPTY_INPUT, y: 1 }, 16);
  expect(p.position.y).toBeGreaterThan(5.4);
  expect(p.position.y).toBeLessThan(5.52);
  expect(canOccupy(s, p, p.position.x, p.position.y)).toBe(true);
});
