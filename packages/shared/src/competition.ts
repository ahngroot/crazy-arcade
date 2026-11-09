import { GAME_CONFIG as C, type Position, type Team } from "./index.js";
import {
  createPractice,
  defeatPlayer,
  random,
  overlapsCell,
  type PracticeState,
  type ItemKind,
} from "./game.js";
import { configureArena, teamCanUseCell, reachableArenaCells } from "./maps.js";

export type MonsterKind = "normal" | "chaser" | "golden";
export interface Monster {
  id: number;
  team: Team;
  kind: MonsterKind;
  position: Position;
  home: Position;
  target: Position | null;
  bornAt: number;
}
export interface SpawnRequest {
  team: Team;
  kind: MonsterKind;
  count: number;
}
export interface CompetitionRound {
  phase: "PLAYING" | "FINISHED";
  durationMs: number;
  winner: Team | "draw" | null;
  warning: "normal" | "rush" | "final";
  monsters: Monster[];
  pending: SpawnRequest[];
  nextSpawnAt: number;
  nextSpawnCheckAt: number;
  events: {
    id: number;
    kind: "kill" | "golden";
    position: Position;
    until: number;
  }[];
}
const teams: Team[] = ["red", "green"];
const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const cellKey = (p: Position) => `${Math.floor(p.x)},${Math.floor(p.y)}`;

export function createCompetition(
  seed: number = C.competitionSeed,
  durationMs: number = C.roundMs,
  arena?: { previousId?: string; id?: string },
): PracticeState {
  if (!Number.isFinite(durationMs) || durationMs < C.fixedStepMs)
    throw new Error("Invalid round duration");
  const s = createPractice(seed);
  if (arena)
    configureArena(s, () => random(s), {
      ...arena,
      minSpawnDistance: C.arenaSpawnMinDistance,
    });
  s.round = {
    phase: "PLAYING",
    durationMs,
    winner: null,
    warning: "normal",
    monsters: [],
    pending: [],
    nextSpawnAt: C.monsterEarlyIntervalMs,
    nextSpawnCheckAt: 0,
    events: [],
  };
  // Legacy fixtures mirror monsters; shared arenas select safe cells independently.
  for (let i = 0; i < C.monsterInitialPerTeam; i++) {
    const red = spawnMonster(s, "red", "normal");
    if (arena) spawnMonster(s, "green", "normal");
    else if (red)
      spawnMonster(s, "green", "normal", {
        x: C.columns - red.position.x,
        y: red.position.y,
      });
  }
  return s;
}

function walkable(s: PracticeState, team: Team, pos: Position) {
  const x = Math.floor(pos.x),
    y = Math.floor(pos.y);
  return (
    teamCanUseCell(s, team, x) &&
    s.map[y]?.[x] === "floor" &&
    !s.balloons.some((b) => b.x === x && b.y === y)
  );
}

export function spawnMonster(
  s: PracticeState,
  team: Team,
  kind: MonsterKind,
  preferred?: Position,
): Monster | null {
  const r = s.round;
  if (
    !r ||
    r.phase !== "PLAYING" ||
    r.monsters.filter((m) => m.team === team).length >= C.maxMonstersPerTeam
  )
    return null;
  // A chaser must be born in the player's reachable component. Normal critters
  // can populate unopened pockets; chasers wait until a passage is cleared.
  let reachable: Set<string> | undefined;
  if (kind === "chaser") {
    const player = s.players.find((p) => p.team === team)!;
    const origin = {
      x: Math.floor(player.position.x) + 0.5,
      y: Math.floor(player.position.y) + 0.5,
    };
    const visit = [origin];
    reachable = new Set();
    for (let i = 0; i < visit.length; i++) {
      const pos = visit[i],
        key = cellKey(pos);
      if (reachable.has(key)) continue;
      reachable.add(key);
      for (const [dx, dy] of dirs) {
        const next = { x: pos.x + dx, y: pos.y + dy };
        if (walkable(s, team, next) && !reachable.has(cellKey(next)))
          visit.push(next);
      }
    }
  }
  const permanentReachable = s.arenaId
    ? reachableArenaCells(s.map, s.players[0].position)
    : null;
  const safe = (pos: Position) =>
    walkable(s, team, pos) &&
    (!permanentReachable || permanentReachable.has(cellKey(pos))) &&
    (!reachable || reachable.has(cellKey(pos))) &&
    !r.monsters.some(
      (m) =>
        Math.hypot(m.position.x - pos.x, m.position.y - pos.y) < 1 ||
        (m.target && cellKey(m.target) === cellKey(pos)),
    ) &&
    !s.players.some(
      (p) =>
        p.status !== "respawning" &&
        Math.hypot(p.position.x - pos.x, p.position.y - pos.y) <
          C.monsterSpawnSafeDistance,
    ) &&
    !s.blasts.some((b) =>
      b.cells.some(
        (c) => c.x === Math.floor(pos.x) && c.y === Math.floor(pos.y),
      ),
    );
  const cells: Position[] = [];
  if (preferred) {
    if (safe(preferred)) cells.push(preferred);
    else return null;
  } else
    for (let y = s.arenaId ? 0 : 1; y < C.rows - (s.arenaId ? 0 : 1); y++)
      for (
        let x = s.arenaId ? 0 : 1;
        x < C.columns - (s.arenaId ? 0 : 1);
        x++
      ) {
        const pos = { x: x + 0.5, y: y + 0.5 };
        if (safe(pos)) cells.push(pos);
      }
  if (!cells.length) return null;
  const pos = cells[Math.floor(random(s) * cells.length)];
  const m: Monster = {
    id: s.nextId++,
    team,
    kind,
    position: { ...pos },
    home: { ...pos },
    target: null,
    bornAt: s.time,
  };
  r.monsters.push(m);
  if (kind === "golden")
    r.events.push({
      id: s.nextId++,
      kind: "golden",
      position: { ...pos },
      until: s.time + 1000,
    });
  return m;
}

export function queueMonster(
  s: PracticeState,
  team: Team,
  kind: MonsterKind,
  count = 1,
) {
  const r = s.round;
  if (!r || r.phase !== "PLAYING") return;
  const existing = r.pending.find((p) => p.team === team && p.kind === kind);
  const queued = r.pending
    .filter((p) => p.team === team)
    .reduce((sum, p) => sum + p.count, 0);
  const amount = Math.max(
    0,
    Math.min(Math.floor(count), C.maxSpawnQueuePerTeam - queued),
  );
  if (!amount) return;
  if (existing) existing.count += amount;
  else r.pending.push({ team, kind, count: amount });
}

/** Population interpretation of the unverified "four monsters" source rule. */
export function maintainChasers(s: PracticeState) {
  const r = s.round!;
  for (const team of teams) {
    const total = r.monsters.filter(
      (m) => m.team === team && m.kind !== "golden",
    );
    const target = Math.min(
      C.maxChasersPerTeam,
      Math.floor(total.length / C.chaserThreshold),
    );
    const present =
      total.filter((m) => m.kind === "chaser").length +
      r.pending
        .filter((p) => p.team === team && p.kind === "chaser")
        .reduce((sum, p) => sum + p.count, 0);
    if (target > present) queueMonster(s, team, "chaser", target - present);
  }
}

export function spawnInterval(s: PracticeState): number {
  const r = s.round!;
  if (r.durationMs - s.time <= C.rushWarningMs) return C.monsterLateIntervalMs;
  if (s.time >= C.monsterMiddleAtMs) return C.monsterMiddleIntervalMs;
  return C.monsterEarlyIntervalMs;
}

function nextTarget(s: PracticeState, m: Monster): Position | null {
  const neighbors = (pos: Position) =>
    dirs
      .map(([dx, dy]) => ({ x: pos.x + dx, y: pos.y + dy }))
      .filter((p) => walkable(s, m.team, p));
  const choices = neighbors(m.position);
  if (!choices.length) return null;
  if (m.kind === "chaser") {
    const player = s.players.find(
      (p) => p.team === m.team && p.status !== "respawning",
    );
    if (player) {
      const target = {
        x: Math.floor(player.position.x) + 0.5,
        y: Math.floor(player.position.y) + 0.5,
      };
      const queue = choices.map((pos) => ({ pos, first: pos })),
        seen = new Set([cellKey(m.position)]);
      let best = queue[0],
        bestDistance = Infinity;
      for (let i = 0; i < queue.length; i++) {
        const node = queue[i],
          key = cellKey(node.pos);
        if (seen.has(key)) continue;
        seen.add(key);
        const distance =
          Math.abs(node.pos.x - target.x) + Math.abs(node.pos.y - target.y);
        if (distance < bestDistance) {
          best = node;
          bestDistance = distance;
        }
        if (distance === 0) return node.first;
        for (const pos of neighbors(node.pos))
          if (!seen.has(cellKey(pos))) queue.push({ pos, first: node.first });
      }
      // Reach the closest reachable cell rather than repeatedly walking into a wall.
      return best.first;
    }
  }
  return choices[Math.floor(random(s) * choices.length)];
}

function moveMonsters(s: PracticeState) {
  for (const m of s.round!.monsters) {
    if (!m.target) {
      m.home = { ...m.position };
      m.target = nextTarget(s, m);
    }
    if (!m.target) continue;
    if (!walkable(s, m.team, m.target)) {
      // A balloon can close both ends while a monster is between cell centers.
      // Keep the path and wait until one end opens instead of entering a balloon.
      if (!walkable(s, m.team, m.home)) continue;
      m.target = { ...m.home };
    }
    const dx = m.target.x - m.position.x,
      dy = m.target.y - m.position.y,
      distance = Math.hypot(dx, dy);
    const speed =
      m.kind === "chaser"
        ? C.chaserSpeed
        : m.kind === "golden"
          ? C.goldenSpeed
          : C.monsterSpeed;
    const amount = Math.min(distance, (speed * C.fixedStepMs) / 1000);
    if (distance > 0) {
      m.position.x += (dx / distance) * amount;
      m.position.y += (dy / distance) * amount;
    }
    if (distance <= amount + 1e-8) {
      m.position = { ...m.target };
      m.target = null;
    }
  }
}

export function resolveMonsterHits(s: PracticeState) {
  const r = s.round;
  if (!r || r.phase !== "PLAYING") return;
  const dead = new Set<number>();
  for (const m of r.monsters) {
    if (s.time < m.bornAt + C.monsterSpawnProtectionMs) continue;
    const blast = s.blasts.find((b) =>
      b.cells.some((c) => overlapsCell(m.position, c, C.monsterRadius)),
    );
    if (!blast) continue;
    const player = s.players.find((p) => p.id === blast.owner);
    if (!player) continue;
    dead.add(m.id);
    player.combo =
      s.time - player.lastKillAt <= C.comboWindowMs ? player.combo + 1 : 1;
    player.lastKillAt = s.time;
    player.score +=
      (m.kind === "golden"
        ? C.goldenScore
        : m.kind === "chaser"
          ? C.chaserScore
          : C.normalScore) + (player.combo >= 2 ? C.comboBonus : 0);
    queueMonster(s, m.team === "red" ? "green" : "red", "normal");
    if (player.combo % C.goldenCombo === 0)
      queueMonster(s, player.team, "golden");
    if (m.kind === "chaser" || (m.kind === "golden" && C.goldenRewardItem)) {
      const kind = (["needle", "shield", "power"] as ItemKind[])[
        Math.floor(random(s) * 3)
      ];
      const x = Math.floor(m.position.x),
        y = Math.floor(m.position.y);
      if (!s.items.some((i) => i.x === x && i.y === y))
        s.items.push({
          id: s.nextId++,
          kind,
          x,
          y,
          availableAt: s.time + C.blastMs,
        });
    }
    r.events.push({
      id: s.nextId++,
      kind: "kill",
      position: { ...m.position },
      until: s.time + 500,
    });
  }
  r.monsters = r.monsters.filter((m) => !dead.has(m.id));
}

export function resolveMonsterContact(s: PracticeState) {
  if (s.round?.phase !== "PLAYING") return;
  for (const p of s.players) {
    if (
      p.status === "respawning" ||
      s.time < Math.max(p.invulnerableUntil, p.shieldUntil)
    )
      continue;
    if (
      s.round!.monsters.some(
        (m) =>
          m.team === p.team &&
          m.kind === "chaser" &&
          s.time >= m.bornAt + C.monsterSpawnProtectionMs &&
          Math.hypot(p.position.x - m.position.x, p.position.y - m.position.y) <
            C.playerRadius + C.monsterRadius,
      )
    ) {
      defeatPlayer(s, p);
      p.combo = 0;
      p.lastKillAt = -C.comboWindowMs - 1;
    }
  }
}

export function advanceCompetition(s: PracticeState) {
  const r = s.round!;
  r.warning =
    r.durationMs - s.time <= C.finalWarningMs
      ? "final"
      : r.durationMs - s.time <= C.rushWarningMs
        ? "rush"
        : "normal";
  r.events = r.events.filter((e) => e.until > s.time).slice(-64);
  for (const p of s.players)
    if (s.time - p.lastKillAt > C.comboWindowMs) p.combo = 0;
  moveMonsters(s);
  resolveMonsterHits(s);
  resolveMonsterContact(s);
  r.nextSpawnAt = Math.min(r.nextSpawnAt, s.time + spawnInterval(s));
  if (s.time >= r.nextSpawnAt) {
    for (const team of teams) queueMonster(s, team, "normal");
    r.nextSpawnAt = s.time + spawnInterval(s);
  }
  maintainChasers(s);
  if (s.time >= r.nextSpawnCheckAt) {
    // Prioritize special spawns; at most six aggregated requests are retained.
    r.pending.sort(
      (a, b) => Number(a.kind === "normal") - Number(b.kind === "normal"),
    );
    for (const request of r.pending)
      while (request.count > 0) {
        if (!spawnMonster(s, request.team, request.kind)) break;
        request.count--;
      }
    r.pending = r.pending.filter((request) => request.count > 0);
    r.nextSpawnCheckAt = s.time + C.monsterSpawnCheckMs;
  }
}

export function finishCompetition(s: PracticeState) {
  const r = s.round!;
  r.phase = "FINISHED";
  const [red, green] = s.players;
  r.winner =
    red.score === green.score
      ? "draw"
      : red.score > green.score
        ? "red"
        : "green";
  s.players.forEach((p) => (p.moving = false));
}
