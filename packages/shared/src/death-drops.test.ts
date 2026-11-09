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
it("scatters remaining active items and applied capacity/speed upgrades on drowning, excludes all range upgrades, and respawns at base stats", () => {
  const s = upgraded(),
    p = s.players[0];
  p.status = "trapped";
  p.statusUntil = C.fixedStepMs;
  stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
  expect(p.deaths).toBe(1);
  expect(p.status).toBe("respawning");
  expect(s.items.map((i) => i.kind).sort()).toEqual([
    "balloon",
    "balloon",
    "needle",
    "shield",
    "speed",
    "speed",
    "speed",
  ]);
  expect(new Set(s.items.map((i) => `${i.x},${i.y}`)).size).toBe(7);
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
  expect(s.items.filter((i) => i.kind === "needle")).toHaveLength(1);
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
it("uses seeded random positions and preserves all items even when only one floor cell exists", () => {
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
  expect(s.items).toHaveLength(7);
  expect(s.items.every((i) => i.x === 1 && i.y === 1)).toBe(true);
  stepPractice(s, [EMPTY_INPUT], C.respawnMs);
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
  expect(s.items).toHaveLength(4);
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
  stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
  expect(p.status).toBe("active");
  expect(p.inventory).toEqual([]);
  stepPractice(s, [EMPTY_INPUT], 250);
  expect(p.inventory).toEqual([]);
  stepPractice(s, [EMPTY_INPUT], C.deathDropPickupDelayMs);
  expect(p.inventory).toEqual(["shield", "needle"]);
  expect(p.shieldUntil).toBe(0);
});
