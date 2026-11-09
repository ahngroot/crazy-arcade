import { expect, it } from "vitest";
import {
  createPractice,
  createCompetition,
  collectItem,
  stepPractice,
  EMPTY_INPUT,
  GAME_CONFIG as C,
} from "./index";
const press = { ...EMPTY_INPUT, useItem: true };

it("starts both teams with no items", () => {
  const s = createCompetition();
  expect(C.inventoryLimit).toBe(2);
  for (const p of s.players) expect(p.inventory).toEqual([]);
});

it("caps the combined inventory at two, including duplicates, while applying passive upgrades immediately", () => {
  const p = createPractice().players[0];
  expect(collectItem(p, "shield")).toBe(true);
  expect(collectItem(p, "needle")).toBe(true);
  expect(collectItem(p, "power")).toBe(true);
  expect(p.inventory).toEqual(["needle", "power"]);
  const before = { capacity: p.capacity, range: p.range, speed: p.speed };
  for (const kind of ["balloon", "range", "speed"] as const)
    expect(collectItem(p, kind)).toBe(true);
  expect(p.capacity).toBe(before.capacity + 1);
  expect(p.range).toBe(before.range + 1);
  expect(p.speed).toBe(before.speed + C.speedIncrement);
  expect(p.inventory).toHaveLength(2);
});

it("uses one FIFO item per fresh Ctrl press and never repeats a held button", () => {
  const s = createPractice(),
    p = s.players[0];
  p.inventory = ["shield", "power"];
  stepPractice(s, [press, EMPTY_INPUT], 100);
  expect(p.inventory).toEqual(["power"]);
  expect(p.shieldUntil).toBeGreaterThan(s.time);
  expect(p.powerUntil).toBe(0);
  stepPractice(s, [press, EMPTY_INPUT], 100);
  expect(p.inventory).toEqual(["power"]);
  stepPractice(s, [EMPTY_INPUT, EMPTY_INPUT], C.fixedStepMs);
  stepPractice(s, [press, EMPTY_INPUT], C.fixedStepMs);
  expect(p.inventory).toEqual([]);
  expect(p.powerUntil).toBeGreaterThan(s.time);
});

it("replaces the oldest full-inventory item on pickup and keeps Ctrl in acquisition order", () => {
  const s = createPractice(),
    p = s.players[0];
  p.inventory = ["shield", "power"];
  s.items.push({ id: s.nextId++, kind: "needle", x: 1, y: 1, availableAt: 0 });
  stepPractice(s, [EMPTY_INPUT, EMPTY_INPUT], C.fixedStepMs);
  expect(s.items).toHaveLength(0);
  expect(p.inventory).toEqual(["power", "needle"]);
  expect(p.powerUntil).toBe(0);
  stepPractice(s, [press, EMPTY_INPUT], C.fixedStepMs);
  expect(s.items).toHaveLength(0);
  expect(p.inventory).toEqual(["needle"]);
  expect(p.powerUntil).toBeGreaterThan(s.time);
});

it("keeps exactly the two newest active items across repeated pickups, including duplicates, without applying passive items to slots", () => {
  const p = createPractice().players[0];
  collectItem(p, "needle");
  collectItem(p, "shield");
  collectItem(p, "shield");
  expect(p.inventory).toEqual(["shield", "shield"]);
  collectItem(p, "needle");
  expect(p.inventory).toEqual(["shield", "needle"]);
  for (const kind of ["speed", "range", "ultra", "balloon"] as const)
    collectItem(p, kind);
  expect(p.inventory).toEqual(["shield", "needle"]);
  expect(p.shieldUntil).toBe(0);
});

it("keeps an unusable first needle until trapped and does not skip to a later shield", () => {
  const s = createPractice(),
    p = s.players[0];
  p.inventory = ["needle", "shield"];
  stepPractice(s, [press, EMPTY_INPUT], C.fixedStepMs);
  expect(p.inventory).toEqual(["needle", "shield"]);
  expect(p.shieldUntil).toBe(0);
  stepPractice(s, [EMPTY_INPUT, EMPTY_INPUT], C.fixedStepMs);
  p.status = "trapped";
  p.statusUntil = s.time + 10000;
  stepPractice(s, [press, EMPTY_INPUT], C.fixedStepMs);
  expect(p.status).toBe("active");
  expect(p.inventory).toEqual(["shield"]);
  expect(p.invulnerableUntil).toBeGreaterThan(s.time);
  stepPractice(s, [press, EMPTY_INPUT], C.fixedStepMs);
  expect(p.shieldUntil).toBe(0);
});

it("does not use a newly acquired item when Ctrl was already held over an empty inventory", () => {
  const s = createPractice(),
    p = s.players[0];
  stepPractice(s, [press, EMPTY_INPUT], C.fixedStepMs);
  collectItem(p, "shield");
  stepPractice(s, [press, EMPTY_INPUT], 100);
  expect(p.inventory).toEqual(["shield"]);
  stepPractice(s, [EMPTY_INPUT, EMPTY_INPUT], C.fixedStepMs);
  stepPractice(s, [press, EMPTY_INPUT], C.fixedStepMs);
  expect(p.inventory).toEqual([]);
});

it("keeps item activation independent for each local player", () => {
  const s = createPractice();
  for (const p of s.players) p.inventory = ["shield", "power"];
  stepPractice(s, [press, EMPTY_INPUT], C.fixedStepMs);
  expect(s.players[0].inventory).toEqual(["power"]);
  expect(s.players[1].inventory).toEqual(["shield", "power"]);
  stepPractice(s, [EMPTY_INPUT, press], C.fixedStepMs);
  expect(s.players[0].inventory).toEqual(["power"]);
  expect(s.players[1].inventory).toEqual(["power"]);
});
