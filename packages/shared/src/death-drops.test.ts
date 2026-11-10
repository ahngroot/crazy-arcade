import { expect, it } from "vitest";
import {
  createSoloPractice,
  createCompetition,
  collectItem,
  defeatPlayer,
  resolveMonsterContact,
  stepPractice,
  EMPTY_INPUT,
  GAME_CONFIG as C,
} from "./index";
function upgraded(seed = 2701) {
  const s = createSoloPractice(seed),
    p = s.players[0];
  s.map = s.map.map((row, y) =>
    row.map((_, x) =>
      x && y && x < C.columns - 1 && y < C.rows - 1 ? "floor" : "wall",
    ),
  );
  p.position = { x: 6.5, y: 6.5 };
  p.characterId = 8;
  collectItem(p, "balloon");
  collectItem(p, "balloon");
  for (let n = 0; n < 3; n++) collectItem(p, "speed");
  collectItem(p, "range");
  collectItem(p, "ultra");
  p.inventory = ["shield", "needle"];
  p.powerUntil =
    p.shieldUntil =
    p.gloveUntil =
    p.shoesUntil =
    p.ghostUntil =
      10000;
  return s;
}
it("scatters the 80% subset across the map without a corpse-distance limit", () => {
  const locations = new Set<string>(),
    subsets = new Set<string>();
  let distant = false;
  for (let seed = 1; seed <= 20; seed++) {
    const s = upgraded(seed),
      p = s.players[0];
    defeatPlayer(s, p);
    expect(s.items).toHaveLength(5);
    subsets.add(
      s.items
        .map((i) => i.kind)
        .sort()
        .join(","),
    );
    for (const item of s.items) {
      locations.add(`${item.x},${item.y}`);
      distant ||=
        Math.hypot(item.x + 0.5 - p.position.x, item.y + 0.5 - p.position.y) >
        6;
      expect(s.map[item.y][item.x]).toBe("floor");
      expect(item.flight!.from).toEqual(p.position);
    }
  }
  expect(distant).toBe(true);
  expect(locations.size).toBeGreaterThan(30);
  expect(subsets.size).toBeGreaterThan(1);
});
it("randomizes each respawn among unoccupied safe floor cells", () => {
  const s = upgraded(123),
    p = s.players[0];
  p.inventory = [];
  p.capacity = C.initialBalloons;
  p.speed = C.movementTilesPerSecond;
  s.items = [
    {
      id: 900,
      kind: "shield",
      x: 2,
      y: 2,
      availableAt: Infinity,
      expiresAt: Infinity,
    },
  ];
  s.balloons = [
    {
      id: 901,
      owner: p.id,
      x: 3,
      y: 3,
      range: 1,
      explodesAt: Infinity,
      passThrough: [p.id],
    },
  ];
  const positions = new Set<string>();
  for (let n = 0; n < 12; n++) {
    defeatPlayer(s, p);
    stepPractice(s, [EMPTY_INPUT], C.respawnMs + C.fixedStepMs);
    expect(p.status).toBe("active");
    const { x, y } = p.position;
    expect(s.map[Math.floor(y)][Math.floor(x)]).toBe("floor");
    expect(x % 1).toBe(0.5);
    expect(y % 1).toBe(0.5);
    expect(x === 2.5 && y === 2.5).toBe(false);
    expect(x === 3.5 && y === 3.5).toBe(false);
    positions.add(`${x},${y}`);
  }
  expect(positions.size).toBeGreaterThan(6);
});
it("scatters remaining active items and applied capacity/speed upgrades on drowning, excludes all range upgrades, and respawns at base stats", () => {
  const s = upgraded(),
    p = s.players[0];
  p.status = "trapped";
  p.statusUntil = C.fixedStepMs;
  stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
  expect(p.deaths).toBe(1);
  expect(p.status).toBe("respawning");
  expect(s.items).toHaveLength(5); // floor(7 eligible retained items * 80%)
  const limits = { balloon: 2, speed: 3, needle: 1, shield: 1 };
  for (const [kind, max] of Object.entries(limits))
    expect(s.items.filter((i) => i.kind === kind).length).toBeLessThanOrEqual(
      max,
    );
  expect(s.items.every((i) => i.kind in limits)).toBe(true);
  expect(new Set(s.items.map((i) => `${i.x},${i.y}`)).size).toBe(5);
  for (const i of s.items) {
    expect(s.map[i.y][i.x]).toBe("floor");
    expect(i.availableAt).toBeGreaterThan(p.statusUntil);
  }
  stepPractice(s, [EMPTY_INPUT], C.respawnMs);
  expect(p.status).toBe("active");
  expect(p.characterId).toBe(8);
  expect([p.capacity, p.range, p.speed]).toEqual([
    C.initialBalloons,
    C.initialRange,
    C.movementTilesPerSecond,
  ]);
  expect(p.inventory).toEqual([]);
  expect([
    p.shieldUntil,
    p.powerUntil,
    p.gloveUntil,
    p.shoesUntil,
    p.ghostUntil,
  ]).toEqual([0, 0, 0, 0, 0]);
});
it("does not scatter consumed or replaced active items, or duplicate items when dying again without upgrades", () => {
  const s = upgraded(),
    p = s.players[0];
  p.inventory = ["shield", "power"];
  collectItem(p, "needle");
  stepPractice(s, [{ ...EMPTY_INPUT, useItem: true }], C.fixedStepMs);
  defeatPlayer(s, p);
  expect(s.items.filter((i) => i.kind === "needle").length).toBeLessThanOrEqual(
    1,
  );
  expect(s.items.some((i) => i.kind === "shield" || i.kind === "power")).toBe(
    false,
  );
  const count = s.items.length;
  defeatPlayer(s, p);
  expect(s.items).toHaveLength(count);
  stepPractice(s, [EMPTY_INPUT], C.respawnMs);
  defeatPlayer(s, p);
  expect(s.items).toHaveLength(count);
  expect(p.deaths).toBe(2);
});
it("resets fluid and ultra without scattering either", () => {
  const s = createSoloPractice(),
    p = s.players[0];
  collectItem(p, "range");
  collectItem(p, "ultra");
  defeatPlayer(s, p);
  expect(s.items).toEqual([]);
  expect(p.range).toBe(C.initialRange);
});
it("uses seeded random positions and keeps the 80% subset even when only one floor cell exists", () => {
  const a = upgraded(1),
    b = upgraded(1),
    c = upgraded(2);
  for (const s of [a, b, c]) defeatPlayer(s, s.players[0]);
  expect(a.items).toEqual(b.items);
  expect(a.items.map((i) => [i.x, i.y])).not.toEqual(
    c.items.map((i) => [i.x, i.y]),
  );
  const s = upgraded();
  s.map = s.map.map((row) => row.map(() => "wall"));
  s.map[1][1] = "floor";
  s.players[0].position = { x: 1.5, y: 1.5 };
  defeatPlayer(s, s.players[0]);
  expect(s.items).toHaveLength(5);
  expect(s.items.every((i) => i.x === 1 && i.y === 1)).toBe(true);
  stepPractice(s, [EMPTY_INPUT], C.respawnMs);
  expect(s.players[0].status).toBe("respawning"); // Only floor contains drops.
  s.items = [];
  stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
  expect(s.players[0].status).toBe("active");
  expect(s.players[0].inventory).toEqual([]);
  expect(s.players[0].capacity).toBe(C.initialBalloons);
});
it("applies the same reset on online chaser death and keeps drops on the victim's side without changing the opponent", () => {
  const s = createCompetition(),
    p = s.players[0],
    other = s.players[1];
  p.inventory = ["needle", "shield"];
  collectItem(p, "balloon");
  collectItem(p, "speed");
  collectItem(p, "ultra");
  other.inventory = ["power"];
  s.round!.monsters = [
    {
      id: 999,
      kind: "chaser",
      team: p.team,
      position: { ...p.position },
      home: { ...p.position },
      target: null,
      bornAt: -10000,
    },
  ];
  resolveMonsterContact(s);
  expect(p.status).toBe("respawning");
  expect(p.inventory).toEqual([]);
  expect(p.range).toBe(C.initialRange);
  expect(s.items).toHaveLength(3);
  expect(s.items.every((i) => i.x < 7)).toBe(true);
  expect(other.inventory).toEqual(["power"]);
  expect(other.deaths).toBe(0);
});

it("respawns at base stats even if blocked until after dropped items become available", () => {
  const s = createSoloPractice(),
    p = s.players[0];
  s.map = s.map.map((row) => row.map(() => "wall"));
  s.map[1][1] = "floor";
  p.inventory = ["shield", "needle"];
  s.balloons = [
    {
      id: 999,
      owner: p.id,
      x: 1,
      y: 1,
      range: 1,
      explodesAt: 10000,
      passThrough: [],
    },
  ];
  defeatPlayer(s, p);
  stepPractice(s, [EMPTY_INPUT], C.respawnMs + C.deathDropPickupDelayMs + 500);
  expect(p.status).toBe("respawning");
  s.balloons = [];
  const drops = s.items;
  s.items = [];
  stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
  expect(p.status).toBe("active");
  expect(p.inventory).toEqual([]);
  s.items = drops;
  stepPractice(s, [EMPTY_INPUT], 250);
  expect(p.inventory).toEqual([]);
  stepPractice(s, [EMPTY_INPUT], C.deathDropPickupDelayMs);
  expect(p.inventory).toEqual(drops.map((i) => i.kind));
  expect(p.shieldUntil).toBe(0);
});
