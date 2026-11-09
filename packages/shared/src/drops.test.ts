import { it, expect } from "vitest";
import { rollCrateItem } from "./drops";
import {
  GAME_CONFIG as C,
  createSoloPractice,
  collectItem,
  placeBalloon,
} from "./index";
it("halves ultra's exact probability while preserving crate item chance and enabled items", () => {
  const counts = new Map<string, number>();
  for (let bin = 0; bin < 60; bin++) {
    const kind = rollCrateItem((bin + 0.5) / 60);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  expect(counts.get("ultra")! / 60).toBe(1 / 6 / 2);
  expect((counts.get("ultra")! / 60) * C.itemDropChance).toBeCloseTo(0.0375);
  for (const kind of ["balloon", "range", "speed", "needle", "shield"])
    expect(counts.get(kind)).toBe(11);
  expect(counts.size).toBe(6);
  expect(rollCrateItem(0)).toBe("balloon");
  expect(rollCrateItem(1 - Number.EPSILON)).toBe("shield");
});
it("uses the ultra appearance only after picking up ultra without changing passive rules", () => {
  const s = createSoloPractice(),
    p = s.players[0];
  placeBalloon(s, p);
  expect(s.balloons[0].ultra).toBe(false);
  s.balloons = [];
  collectItem(p, "ultra");
  placeBalloon(s, p);
  expect(s.balloons[0].ultra).toBe(true);
  expect(s.balloons[0].range).toBe(C.maxRange);
  expect(p.inventory).toEqual([]);
});
