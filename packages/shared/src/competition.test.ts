import { describe, it, expect } from "vitest";
import {
  createCompetition,
  stepPractice,
  spawnMonster,
  queueMonster,
  resolveMonsterHits,
  resolveMonsterContact,
  maintainChasers,
  spawnInterval,
  collectItem,
  effectiveStats,
  GAME_CONFIG as C,
  EMPTY_INPUT,
  type PracticeState,
  type MonsterKind,
} from "./index";
const idle = [EMPTY_INPUT, EMPTY_INPUT];
function arena(duration: number = C.roundMs) {
  const s = createCompetition(1, duration);
  s.round!.monsters = [];
  s.map = s.map.map((row, y) =>
    row.map((_, x) =>
      x === 0 || x === 14 || x === 7 || y === 0 || y === 12 ? "wall" : "floor",
    ),
  );
  return s;
}
function monster(s: PracticeState, kind: MonsterKind = "normal", x = 3, y = 5) {
  const m = spawnMonster(s, "red", kind, { x: x + 0.5, y: y + 0.5 })!;
  expect(m).toBeTruthy();
  m.bornAt = -1000;
  return m;
}
function hit(s: PracticeState, x = 3, y = 5, owner = "p1") {
  s.blasts.push({
    id: s.nextId++,
    owner,
    cells: [{ x, y }],
    expiresAt: s.time + C.blastMs,
  });
  resolveMonsterHits(s);
}

describe("competition kills and population", () => {
  it("starts with mirrored equal populations and balanced consumables", () => {
    const s = createCompetition();
    const r = s.round!;
    expect(
      r.monsters
        .filter((m) => m.team === "red")
        .map((m) => [m.position.x, m.position.y]),
    ).toEqual(
      r.monsters
        .filter((m) => m.team === "green")
        .map((m) => [C.columns - m.position.x, m.position.y]),
    );
    expect(s.players[0].inventory).toEqual(s.players[1].inventory);
    expect(r.monsters).toHaveLength(C.monsterInitialPerTeam * 2);
  });
  it("scores a kill once and forwards a normal monster to the opponent", () => {
    const s = arena();
    monster(s);
    hit(s);
    resolveMonsterHits(s);
    expect(s.players[0].score).toBe(C.normalScore);
    expect(s.round!.monsters).toHaveLength(0);
    expect(s.round!.pending).toContainEqual({
      team: "green",
      kind: "normal",
      count: 1,
    });
    stepPractice(s, idle, C.fixedStepMs);
    expect(s.round!.monsters.some((m) => m.team === "green")).toBe(true);
  });
  it("scores simultaneous kills individually with no repeated reward from lingering water", () => {
    const s = arena();
    monster(s, "normal", 2, 5);
    monster(s, "normal", 3, 5);
    monster(s, "normal", 4, 5);
    s.blasts.push({
      id: 99,
      owner: "p1",
      cells: [
        { x: 2, y: 5 },
        { x: 3, y: 5 },
        { x: 4, y: 5 },
      ],
      expiresAt: 500,
    });
    resolveMonsterHits(s);
    resolveMonsterHits(s);
    expect(s.players[0].score).toBe(3 * C.normalScore + 2 * C.comboBonus);
    expect(s.players[0].combo).toBe(3);
    expect(s.round!.pending[0].count).toBe(3);
  });
  it("protects newly spawned monsters from immediate blast damage", () => {
    const s = arena();
    const m = monster(s);
    m.bornAt = 0;
    hit(s);
    expect(s.players[0].score).toBe(0);
    s.time = C.monsterSpawnProtectionMs;
    resolveMonsterHits(s);
    expect(s.players[0].score).toBe(C.normalScore);
  });
  it("combos within three seconds, spawns gold at eight and expires the streak", () => {
    const s = arena();
    for (let i = 0; i < 8; i++) {
      s.time = i * 100;
      s.blasts = [];
      monster(s);
      hit(s);
    }
    expect(s.players[0].combo).toBe(8);
    expect(s.players[0].score).toBe(8 * C.normalScore + 7 * C.comboBonus);
    expect(s.round!.pending).toContainEqual({
      team: "red",
      kind: "golden",
      count: 1,
    });
    s.time += C.comboWindowMs + 1;
    s.blasts = [];
    monster(s);
    hit(s);
    expect(s.players[0].combo).toBe(1);
    const t = arena();
    monster(t);
    hit(t);
    stepPractice(t, idle, C.comboWindowMs + 100);
    expect(t.players[0].combo).toBe(0);
  });
  it("awards golden points and a special item and forwards chasers as normals", () => {
    const s = arena();
    monster(s, "golden");
    hit(s);
    expect(s.players[0].score).toBe(C.goldenScore);
    expect(s.items).toHaveLength(1);
    expect(["needle", "shield", "power"]).toContain(s.items[0].kind);
    const t = arena();
    monster(t, "chaser");
    hit(t);
    expect(t.players[0].score).toBe(C.chaserScore);
    expect(t.items).toHaveLength(1);
    expect(t.round!.pending).toEqual([
      { team: "green", kind: "normal", count: 1 },
    ]);
  });
  it("counts four living normal/chaser monsters and never queues duplicate chasers", () => {
    const s = arena();
    for (const [x, y] of [
      [2, 4],
      [4, 4],
      [2, 7],
      [4, 7],
    ])
      monster(s, "normal", x, y);
    maintainChasers(s);
    maintainChasers(s);
    expect(s.round!.pending).toEqual([
      { team: "red", kind: "chaser", count: 1 },
    ]);
  });
  it("uses safe floor positions, respects team caps and bounds the spawn queue", () => {
    const s = arena();
    for (let i = 0; i < 100; i++) spawnMonster(s, "red", "normal");
    expect(s.round!.monsters).toHaveLength(C.maxMonstersPerTeam);
    const cells = new Set(
      s.round!.monsters.map((m) => `${m.position.x},${m.position.y}`),
    );
    expect(cells.size).toBe(C.maxMonstersPerTeam);
    for (const m of s.round!.monsters)
      expect(s.map[Math.floor(m.position.y)][Math.floor(m.position.x)]).toBe(
        "floor",
      );
    queueMonster(s, "red", "normal", 999);
    queueMonster(s, "red", "normal", 999);
    expect(s.round!.pending[0].count).toBe(C.maxSpawnQueuePerTeam);
    const t = arena();
    t.map = t.map.map((row) => row.map(() => "wall"));
    queueMonster(t, "red", "normal");
    stepPractice(t, idle, 1000);
    expect(t.round!.monsters).toHaveLength(0);
    expect(t.round!.pending[0].count).toBe(1);
  });
});

describe("AI and contact", () => {
  it("normals are harmless but a chaser causes immediate respawn without ending the round", () => {
    const s = arena(),
      p = s.players[0];
    const m = monster(s, "normal");
    p.position = { ...m.position };
    resolveMonsterContact(s);
    expect(p.status).toBe("active");
    m.kind = "chaser";
    resolveMonsterContact(s);
    expect(p.status).toBe("respawning");
    expect(p.deaths).toBe(1);
    resolveMonsterContact(s);
    expect(p.deaths).toBe(1);
    expect(s.round!.phase).toBe("PLAYING");
    stepPractice(s, idle, C.respawnMs + C.fixedStepMs);
    expect(p.status).toBe("active");
  });
  it("chasers approach by reachable paths and monsters never enter walls or cross teams", () => {
    const s = arena();
    const m = monster(s, "chaser", 5, 5);
    s.players[0].position = { x: 1.5, y: 5.5 };
    stepPractice(s, idle, 1000);
    expect(m.position.x).toBeLessThan(5.5);
    for (let i = 0; i < 100; i++) {
      stepPractice(s, idle, 100);
      for (const mon of s.round!.monsters) {
        expect(
          s.map[Math.floor(mon.position.y)][Math.floor(mon.position.x)],
        ).toBe("floor");
        expect(
          mon.team === "red" ? mon.position.x < 7 : mon.position.x > 8,
        ).toBe(true);
      }
    }
  });
  it("reroutes when a balloon blocks its destination", () => {
    const s = arena();
    const m = monster(s, "chaser", 3, 5);
    s.players[0].position = { x: 1.5, y: 5.5 };
    s.balloons.push({
      id: 99,
      owner: "p1",
      x: 2,
      y: 5,
      range: 1,
      explodesAt: 99999,
      passThrough: [],
    });
    stepPractice(s, idle, 1000);
    expect(
      Math.floor(m.position.x) === 2 && Math.floor(m.position.y) === 5,
    ).toBe(false);
  });
  it("keeps unreachable chasers queued until a crate passage is cleared", () => {
    const s = arena();
    s.map[1][2] = "crate";
    s.map[2][1] = "crate";
    expect(spawnMonster(s, "red", "chaser", { x: 4.5, y: 5.5 })).toBeNull();
    s.map[2][1] = "floor";
    expect(spawnMonster(s, "red", "chaser", { x: 4.5, y: 5.5 })).not.toBeNull();
  });
});

describe("special items and round lifecycle", () => {
  it("uses a needle only while trapped and protects against immediate retrapping", () => {
    const s = arena(),
      p = s.players[0];
    p.status = "trapped";
    p.statusUntil = 9999;
    s.blasts.push({
      id: 99,
      owner: "p1",
      cells: [{ x: 1, y: 1 }],
      expiresAt: 1000,
    });
    stepPractice(s, [{ ...EMPTY_INPUT, needle: true }, EMPTY_INPUT], 100);
    expect(p.status).toBe("active");
    expect(p.inventory.needle).toBe(0);
    expect(p.deaths).toBe(0);
  });
  it("shields from contact and water, expires and consumes once per press", () => {
    const s = arena(),
      p = s.players[0];
    const m = monster(s, "chaser");
    p.position = { ...m.position };
    p.inventory.shield = 2;
    stepPractice(s, [{ ...EMPTY_INPUT, shield: true }, EMPTY_INPUT], 100);
    expect(p.inventory.shield).toBe(1);
    expect(p.status).toBe("active");
    // Keep this chaser outside the water used to test the player's shield.
    m.position = { x: 5.5, y: 9.5 };
    m.home = { ...m.position };
    m.target = null;
    s.blasts.push({
      id: 99,
      owner: "p1",
      cells: [{ x: Math.floor(p.position.x), y: Math.floor(p.position.y) }],
      expiresAt: s.time + 500,
    });
    stepPractice(s, [{ ...EMPTY_INPUT, shield: true }, EMPTY_INPUT], 100);
    expect(p.status).toBe("active");
    expect(p.inventory.shield).toBe(1);
    s.time = p.shieldUntil;
    m.position = { ...p.position };
    resolveMonsterContact(s);
    expect(p.status).toBe("respawning");
  });
  it("temporarily powers stats without mutating permanent upgrades and caps inventory", () => {
    const s = arena(),
      p = s.players[0];
    stepPractice(s, [{ ...EMPTY_INPUT, power: true }, EMPTY_INPUT], 100);
    expect(effectiveStats(s, p).range).toBe(p.range + C.powerRangeBonus);
    expect(p.range).toBe(1);
    s.time = p.powerUntil;
    expect(effectiveStats(s, p).range).toBe(p.range);
    for (let i = 0; i < 10; i++) collectItem(p, "power");
    expect(p.inventory.power).toBe(C.inventoryLimit);
  });
  it("increases spawn frequency and shows separate 30 and 15 second warnings", () => {
    const s = arena();
    expect(spawnInterval(s)).toBe(C.monsterEarlyIntervalMs);
    s.time = C.monsterMiddleAtMs;
    expect(spawnInterval(s)).toBe(C.monsterMiddleIntervalMs);
    s.time = C.roundMs - C.rushWarningMs;
    expect(spawnInterval(s)).toBe(C.monsterLateIntervalMs);
    const t = arena(31_000);
    stepPractice(t, idle, 1100);
    expect(t.round!.warning).toBe("rush");
    stepPractice(t, idle, 15_000);
    expect(t.round!.warning).toBe("final");
  });
  it("finishes a full 180-second round, freezes scoring/spawns and reports red, green or draw", () => {
    for (const scores of [
      [2, 1],
      [1, 2],
      [0, 0],
    ]) {
      const s = arena();
      [s.players[0].score, s.players[1].score] = scores;
      stepPractice(s, idle, C.roundMs);
      expect(s.round!.phase).toBe("FINISHED");
      expect(s.time).toBe(C.roundMs);
      expect(s.round!.winner).toBe(
        scores[0] === scores[1]
          ? "draw"
          : scores[0] > scores[1]
            ? "red"
            : "green",
      );
      const before = JSON.stringify(s);
      stepPractice(s, idle, 1000);
      queueMonster(s, "red", "golden");
      resolveMonsterHits(s);
      expect(JSON.stringify(s)).toBe(before);
    }
  });
  it("replays the same seed exactly and bounds late-game monsters and events", () => {
    const a = arena(),
      b = arena();
    stepPractice(a, idle, C.roundMs);
    stepPractice(b, idle, C.roundMs);
    expect(a).toEqual(b);
    for (const team of ["red", "green"])
      expect(
        a.round!.monsters.filter((m) => m.team === team).length,
      ).toBeLessThanOrEqual(C.maxMonstersPerTeam);
    expect(a.round!.events.length).toBeLessThanOrEqual(64);
    expect(a.round!.pending.length).toBeLessThanOrEqual(6);
  });
});
