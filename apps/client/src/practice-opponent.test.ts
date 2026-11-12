import { describe, expect, it } from "vitest";
import {
  ARENAS,
  canOccupy,
  createArenaPractice,
  defeatPlayer,
  EMPTY_INPUT,
  GAME_CONFIG as C,
  stepPractice,
} from "@bubble/shared";
import { addPracticeOpponent, roamingOpponent } from "./practice-opponent";

describe("movement-only practice opponent", () => {
  it("travels 2.5 tiles per second and retains that speed after death", () => {
    const s = createArenaPractice(42);
    addPracticeOpponent(s);
    s.map.forEach((row) => row.fill("floor"));
    const p = s.players[1];
    p.position = { x: 7.5, y: 6.5 };
    const input = roamingOpponent();
    let distance = 0;
    expect(p.speed).toBe(2.5);
    expect(s.players[0].speed).toBe(4);
    for (let n = 0; n < 60; n++) {
      const before = { ...p.position };
      stepPractice(s, () => [EMPTY_INPUT, input(s)], C.fixedStepMs);
      distance += Math.hypot(p.position.x - before.x, p.position.y - before.y);
    }
    expect(distance).toBeCloseTo(2.5, 8);
    defeatPlayer(s, p);
    expect(p.speed).toBe(2.5);
  });
  for (const arena of ARENAS)
    it(`roams safely in ${arena.id}`, () => {
      const s = createArenaPractice(42, undefined, arena.id);
      addPracticeOpponent(s);
      const p = s.players[1],
        input = roamingOpponent(),
        start = { ...p.position };
      expect(s.players).toHaveLength(2);
      expect(p.practiceOpponent).toBe(true);
      expect(
        Math.hypot(
          p.position.x - s.players[0].position.x,
          p.position.y - s.players[0].position.y,
        ),
      ).toBeGreaterThan(3);
      const visited = new Set<string>();
      for (let n = 0; n < 900; n++) {
        const before = { ...p.position };
        stepPractice(s, () => [EMPTY_INPUT, input(s)], C.fixedStepMs);
        expect(canOccupy(s, p, p.position.x, p.position.y)).toBe(true);
        expect(
          Math.abs(p.position.x - before.x) > 1e-6 &&
            Math.abs(p.position.y - before.y) > 1e-6,
        ).toBe(false);
        visited.add(`${Math.floor(p.position.x)},${Math.floor(p.position.y)}`);
      }
      expect(visited.size).toBeGreaterThanOrEqual(3);
      expect(s.balloons).toHaveLength(0);
      expect(p.inventory).toEqual([]);
      expect(
        Math.hypot(p.position.x - start.x, p.position.y - start.y),
      ).toBeLessThan(30);
    });
  it("makes the same decisions for 60Hz and batched frames", () => {
    const a = createArenaPractice(9),
      b = createArenaPractice(9);
    addPracticeOpponent(a);
    addPracticeOpponent(b);
    const ai = roamingOpponent(),
      bi = roamingOpponent();
    for (let i = 0; i < 600; i++)
      stepPractice(a, () => [EMPTY_INPUT, ai(a)], C.fixedStepMs);
    for (let i = 0; i < 60; i++)
      stepPractice(b, () => [EMPTY_INPUT, bi(b)], C.fixedStepMs * 10);
    expect(a.players[1].position).toEqual(b.players[1].position);
  });
  it("does not collect items and resumes safely after respawning", () => {
    const s = createArenaPractice(9);
    addPracticeOpponent(s);
    const p = s.players[1];
    const input = roamingOpponent();
    s.items = [
      {
        id: 999,
        kind: "speed",
        x: Math.floor(p.position.x),
        y: Math.floor(p.position.y),
        availableAt: 0,
      },
    ];
    stepPractice(s, [EMPTY_INPUT, EMPTY_INPUT], C.fixedStepMs);
    expect(s.items).toHaveLength(1);
    p.status = "respawning";
    p.statusUntil = s.time + 100;
    for (let i = 0; i < 120; i++)
      stepPractice(s, () => [EMPTY_INPUT, input(s)], C.fixedStepMs);
    expect(p.status).toBe("active");
    expect(canOccupy(s, p, p.position.x, p.position.y)).toBe(true);
  });
});
