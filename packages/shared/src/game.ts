import {
  createPreviewMap,
  GAME_CONFIG as C,
  type Position,
  type Tile,
  type Team,
} from "./index.js";
import {
  advanceCompetition,
  finishCompetition,
  type CompetitionRound,
} from "./competition.js";

export type Facing = "up" | "down" | "left" | "right";
export type ItemKind =
  "balloon" | "range" | "speed" | "needle" | "shield" | "power";
export type UsableItemKind = Extract<ItemKind, "needle" | "shield" | "power">;
export interface LocalInput {
  x: number;
  y: number;
  balloon: boolean;
  useItem?: boolean;
}
export interface PracticePlayer {
  id: string;
  team: Team;
  position: Position;
  spawn: Position;
  facing: Facing;
  status: "active" | "trapped" | "respawning";
  statusUntil: number;
  invulnerableUntil: number;
  capacity: number;
  range: number;
  speed: number;
  deaths: number;
  moving: boolean;
  bombDown: boolean;
  score: number;
  combo: number;
  lastKillAt: number;
  /** Oldest acquired item first. One entry occupies one of the two slots. */
  inventory: UsableItemKind[];
  itemDown: boolean;
  shieldUntil: number;
  powerUntil: number;
}
export interface Balloon {
  id: number;
  owner: string;
  x: number;
  y: number;
  range: number;
  explodesAt: number;
  passThrough: string[];
}
export interface Blast {
  id: number;
  owner: string;
  cells: Position[];
  expiresAt: number;
}
export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  availableAt: number;
}
export interface PracticeState {
  time: number;
  tick: number;
  seed: number;
  nextId: number;
  mapRevision: number;
  accumulator: number;
  map: Tile[][];
  players: PracticePlayer[];
  balloons: Balloon[];
  blasts: Blast[];
  items: Item[];
  round?: CompetitionRound;
}
export const EMPTY_INPUT: LocalInput = Object.freeze({
  x: 0,
  y: 0,
  balloon: false,
});

export function createPractice(seed = 2701): PracticeState {
  return {
    time: 0,
    tick: 0,
    seed: seed >>> 0,
    nextId: 1,
    mapRevision: 0,
    accumulator: 0,
    map: createPreviewMap(),
    balloons: [],
    blasts: [],
    items: [],
    players: (["red", "green"] as const).map((team, i) => ({
      id: `p${i + 1}`,
      team,
      position: { x: i ? 13.5 : 1.5, y: 1.5 },
      spawn: { x: i ? 13.5 : 1.5, y: 1.5 },
      facing: "down",
      status: "active",
      statusUntil: 0,
      invulnerableUntil: 0,
      capacity: C.initialBalloons,
      range: C.initialRange,
      speed: C.movementTilesPerSecond,
      deaths: 0,
      moving: false,
      bombDown: false,
      score: 0,
      combo: 0,
      lastKillAt: -C.comboWindowMs - 1,
      inventory: [],
      itemDown: false,
      shieldUntil: 0,
      powerUntil: 0,
    })),
  };
}

/** Unlimited solo practice uses one real player and the same item rules as online. */
export function createSoloPractice(seed = 2701): PracticeState {
  const state = createPractice(seed);
  state.players = state.players.slice(0, 1);
  state.players[0].inventory = ["shield", "power"];
  return state;
}

export function random(s: PracticeState) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
const key = (x: number, y: number) => `${x},${y}`;
const sameCell = (a: Position, b: Position) =>
  Math.floor(a.x) === Math.floor(b.x) && Math.floor(a.y) === Math.floor(b.y);
export function overlapsCell(
  position: Position,
  cell: Position,
  radius: number = C.playerRadius,
) {
  return (
    position.x + radius > cell.x &&
    position.x - radius < cell.x + 1 &&
    position.y + radius > cell.y &&
    position.y - radius < cell.y + 1
  );
}

export function canOccupy(
  s: PracticeState,
  player: PracticePlayer,
  x: number,
  y: number,
): boolean {
  const r = C.playerRadius;
  for (let cy = Math.floor(y - r); cy <= Math.floor(y + r - 1e-8); cy++)
    for (let cx = Math.floor(x - r); cx <= Math.floor(x + r - 1e-8); cx++) {
      if (s.map[cy]?.[cx] !== "floor") return false;
      if (
        s.balloons.some(
          (b) => b.x === cx && b.y === cy && !b.passThrough.includes(player.id),
        )
      )
        return false;
    }
  return true;
}

export function effectiveStats(s: PracticeState, p: PracticePlayer) {
  const power = p.powerUntil > s.time;
  return {
    speed: p.speed + (power ? C.powerSpeedBonus : 0),
    range: p.range + (power ? C.powerRangeBonus : 0),
    capacity: p.capacity + (power ? C.powerCapacityBonus : 0),
  };
}

function useItems(s: PracticeState, p: PracticePlayer, input: LocalInput) {
  const pressed = Boolean(input.useItem);
  const freshPress = pressed && !p.itemDown;
  p.itemDown = pressed;
  const kind = p.inventory[0];
  if (!freshPress || !kind) return;
  if (kind === "needle" && p.status === "trapped") {
    p.inventory.shift();
    p.status = "active";
    p.invulnerableUntil = s.time + C.needleProtectionMs;
  } else if (kind !== "needle" && p.status === "active") {
    p.inventory.shift();
    p[`${kind}Until`] = s.time + (kind === "shield" ? C.shieldMs : C.powerMs);
  }
}

export function collectItem(p: PracticePlayer, kind: ItemKind): boolean {
  if (kind === "balloon") p.capacity = Math.min(C.maxBalloons, p.capacity + 1);
  else if (kind === "range") p.range = Math.min(C.maxRange, p.range + 1);
  else if (kind === "speed")
    p.speed = Math.min(C.maxSpeed, p.speed + C.speedIncrement);
  else {
    if (p.inventory.length >= C.inventoryLimit) return false;
    p.inventory.push(kind);
  }
  return true;
}

export function movePlayer(
  s: PracticeState,
  p: PracticePlayer,
  raw: LocalInput,
  dt: number,
) {
  let x = Number.isFinite(raw.x) ? Math.max(-1, Math.min(1, raw.x)) : 0;
  let y = Number.isFinite(raw.y) ? Math.max(-1, Math.min(1, raw.y)) : 0;
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  if (x || y)
    p.facing =
      Math.abs(x) > Math.abs(y)
        ? x > 0
          ? "right"
          : "left"
        : y > 0
          ? "down"
          : "up";
  const distance = (effectiveStats(s, p).speed * dt) / 1000;
  const oldX = p.position.x,
    oldY = p.position.y;
  const dx = x * distance,
    dy = y * distance;
  if (canOccupy(s, p, oldX + dx, oldY)) p.position.x += dx;
  if (canOccupy(s, p, p.position.x, oldY + dy)) p.position.y += dy;
  // Gently align to a corridor when only slightly off its center. Every nudge is collision-checked.
  if (x && !y && p.position.x === oldX) {
    const target = Math.floor(oldY) + 0.5,
      offset = target - oldY;
    if (
      Math.abs(offset) <= C.cornerAssist &&
      canOccupy(s, p, oldX + dx, target)
    ) {
      const nextY =
        oldY + Math.sign(offset) * Math.min(Math.abs(offset), distance);
      if (canOccupy(s, p, oldX, nextY)) p.position.y = nextY;
      if (canOccupy(s, p, oldX + dx, p.position.y)) p.position.x += dx;
    }
  } else if (y && !x && p.position.y === oldY) {
    const target = Math.floor(oldX) + 0.5,
      offset = target - oldX;
    if (
      Math.abs(offset) <= C.cornerAssist &&
      canOccupy(s, p, target, oldY + dy)
    ) {
      const nextX =
        oldX + Math.sign(offset) * Math.min(Math.abs(offset), distance);
      if (canOccupy(s, p, nextX, oldY)) p.position.x = nextX;
      if (canOccupy(s, p, p.position.x, oldY + dy)) p.position.y += dy;
    }
  }
  p.moving = p.position.x !== oldX || p.position.y !== oldY;
}

export function placeBalloon(s: PracticeState, p: PracticePlayer): boolean {
  if (s.round?.phase === "FINISHED") return false;
  if (
    p.status !== "active" ||
    s.balloons.filter((b) => b.owner === p.id).length >=
      effectiveStats(s, p).capacity
  )
    return false;
  const x = Math.floor(p.position.x),
    y = Math.floor(p.position.y);
  if (
    s.map[y]?.[x] !== "floor" ||
    s.balloons.some((b) => b.x === x && b.y === y)
  )
    return false;
  s.balloons.push({
    id: s.nextId++,
    owner: p.id,
    x,
    y,
    range: effectiveStats(s, p).range,
    explodesAt: s.time + C.balloonFuseMs,
    passThrough: s.players
      .filter(
        (other) =>
          other.status === "active" && overlapsCell(other.position, { x, y }),
      )
      .map((other) => other.id),
  });
  return true;
}

function explode(s: PracticeState) {
  const activeCells = new Set(
    s.blasts.flatMap((b) => b.cells.map((c) => key(c.x, c.y))),
  );
  const queue = s.balloons.filter(
    (b) => b.explodesAt <= s.time || activeCells.has(key(b.x, b.y)),
  );
  const exploded = new Set<number>(),
    broken = new Set<string>();
  const byCell = new Map(s.balloons.map((b) => [key(b.x, b.y), b]));
  for (let i = 0; i < queue.length; i++) {
    const balloon = queue[i];
    if (exploded.has(balloon.id)) continue;
    exploded.add(balloon.id);
    const cells: Position[] = [{ x: balloon.x, y: balloon.y }];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      for (let distance = 1; distance <= balloon.range; distance++) {
        const x = balloon.x + dx * distance,
          y = balloon.y + dy * distance;
        const tile = s.map[y]?.[x];
        if (!tile || tile === "wall") break;
        cells.push({ x, y });
        if (tile === "crate") {
          broken.add(key(x, y));
          break;
        }
        const next = byCell.get(key(x, y));
        if (next) {
          if (!exploded.has(next.id)) queue.push(next);
          break;
        }
      }
    }
    s.blasts.push({
      id: balloon.id,
      owner: balloon.owner,
      cells,
      expiresAt: s.time + C.blastMs,
    });
    const hitCells = new Set(cells.map((c) => key(c.x, c.y)));
    s.items = s.items.filter(
      (item) => item.availableAt > s.time || !hitCells.has(key(item.x, item.y)),
    );
  }
  s.balloons = s.balloons.filter((b) => !exploded.has(b.id));
  for (const coordinate of broken) {
    const [x, y] = coordinate.split(",").map(Number);
    s.map[y][x] = "floor";
    s.mapRevision++;
    if (random(s) < C.itemDropChance) {
      const kind = (["balloon", "range", "speed"] as const)[
        Math.floor(random(s) * 3)
      ];
      s.items.push({
        id: s.nextId++,
        kind,
        x,
        y,
        availableAt: s.time + C.blastMs,
      });
    }
  }
}

export function inBlast(s: PracticeState, position: Position) {
  return s.blasts.some((b) =>
    b.cells.some((cell) => overlapsCell(position, cell)),
  );
}

function respawn(s: PracticeState, p: PracticePlayer) {
  const candidates: Position[] = [];
  for (let y = 1; y < C.rows - 1; y++)
    for (let x = 1; x < C.columns - 1; x++) {
      if ((p.team === "red" ? x < 7 : x > 7) && s.map[y][x] === "floor")
        candidates.push({ x: x + 0.5, y: y + 0.5 });
    }
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - p.spawn.x, a.y - p.spawn.y) -
      Math.hypot(b.x - p.spawn.x, b.y - p.spawn.y),
  );
  const safe = candidates.find(
    (pos) =>
      canOccupy(s, p, pos.x, pos.y) &&
      !inBlast(s, pos) &&
      !s.round?.monsters.some(
        (m) =>
          Math.hypot(m.position.x - pos.x, m.position.y - pos.y) <
          C.monsterSpawnSafeDistance,
      ) &&
      !s.players.some(
        (other) =>
          other !== p &&
          other.status !== "respawning" &&
          sameCell(pos, other.position),
      ),
  );
  if (safe) {
    p.position = safe;
    p.status = "active";
    p.invulnerableUntil = s.time + C.invulnerableMs;
    p.facing = "down";
  }
}

function tick(s: PracticeState, inputs: readonly LocalInput[]) {
  const dt = C.fixedStepMs;
  s.tick++;
  s.time = s.tick * dt;
  if (s.round && s.time >= s.round.durationMs) {
    s.time = s.round.durationMs;
    finishCompetition(s);
    return;
  }
  s.blasts = s.blasts.filter((b) => b.expiresAt > s.time);
  for (const [index, p] of s.players.entries()) {
    p.moving = false;
    const input = inputs[index] ?? EMPTY_INPUT;
    useItems(s, p, input);
    if (p.status === "trapped" && s.time >= p.statusUntil) {
      p.status = "respawning";
      p.statusUntil = s.time + C.respawnMs;
      p.deaths++;
    }
    if (p.status === "respawning" && s.time >= p.statusUntil) respawn(s, p);
    if (p.status === "active") {
      movePlayer(s, p, input, dt);
      // Remove the pass-through permission once the entire body has left the cell.
      for (const b of s.balloons)
        if (!overlapsCell(p.position, b))
          b.passThrough = b.passThrough.filter((id) => id !== p.id);
      if (input.balloon && !p.bombDown) placeBalloon(s, p);
    }
    p.bombDown = Boolean(input.balloon);
  }
  explode(s);
  if (s.round) advanceCompetition(s);
  for (const p of s.players) {
    if (p.status !== "active") continue;
    if (
      s.time >= Math.max(p.invulnerableUntil, p.shieldUntil) &&
      inBlast(s, p.position)
    ) {
      p.status = "trapped";
      p.statusUntil = s.time + C.trappedMs;
      p.moving = false;
      continue;
    }
    s.items = s.items.filter((item) => {
      if (item.availableAt > s.time || !sameCell(p.position, item)) return true;
      return !collectItem(p, item.kind);
    });
  }
}

/** Fixed-step simulation; accepts elapsed milliseconds and has no browser dependency. */
export function stepPractice(
  s: PracticeState,
  inputs: readonly LocalInput[],
  elapsedMs: number,
) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
  if (s.round?.phase === "FINISHED") return;
  s.accumulator += elapsedMs;
  while (s.accumulator + 1e-7 >= C.fixedStepMs) {
    tick(s, inputs);
    s.accumulator -= C.fixedStepMs;
    if (s.round && s.time >= s.round.durationMs) {
      s.accumulator = 0;
      break;
    }
  }
}
