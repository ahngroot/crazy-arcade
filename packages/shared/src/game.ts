import {
  createPreviewMap,
  createBattleMap,
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
import { rollCrateItem } from "./drops.js";
import { configureArena, teamCanUseCell, arenaSpawnCells } from "./maps.js";

export type Facing = "up" | "down" | "left" | "right";
export type ItemKind =
  | "balloon"
  | "range"
  | "speed"
  | "needle"
  | "shield"
  | "power"
  | "ultra"
  | "glove"
  | "shoes"
  | "ghost";
export type UsableItemKind = Exclude<
  ItemKind,
  "balloon" | "range" | "speed" | "ultra"
>;
export interface LocalInput {
  x: number;
  y: number;
  balloon: boolean;
  useItem?: boolean;
  turn?: Facing;
  turnId?: number;
}
export interface PracticePlayer {
  /** Local practice-only appearance; not a selectable online character. */
  practiceOpponent?: boolean;
  balloonSkinId?: number;
  characterId?: number;
  id: string;
  team: Team;
  position: Position;
  /** Finish the current tile before accepting a turn or stopping. */
  moveTarget?: Position;
  queuedTurn?: Facing;
  queuedTurnRemainingMs?: number;
  lastTurnId?: number;
  spawn: Position;
  facing: Facing;
  status: "active" | "trapped" | "respawning";
  statusUntil: number;
  invulnerableUntil: number;
  pickupBlockedUntil?: number;
  capacity: number;
  range: number;
  /** Actual fluid upgrades, separate from ultra's synthetic range increase. */
  rangePickups?: number;
  ultraPickup?: boolean;
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
  gloveUntil?: number;
  shoesUntil?: number;
  ghostUntil?: number;
}
export interface Balloon {
  skinId?: number;
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
  expiresAt?: number;
  flight?: { from: Position; startedAt: number; landsAt: number };
}
export interface PracticeState {
  time: number;
  tick: number;
  seed: number;
  nextId: number;
  mapRevision: number;
  accumulator: number;
  map: Tile[][];
  terrain?: "garden" | "battle" | "themed";
  arenaId?: string;
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
  state.map = createBattleMap();
  state.terrain = "battle";
  state.players = state.players.slice(0, 1);
  return state;
}

export function createArenaPractice(
  seed: number,
  previousId?: string,
  id?: string,
): PracticeState {
  const s = createSoloPractice(seed);
  configureArena(s, () => random(s), {
    previousId,
    id,
    minSpawnDistance: C.arenaSpawnMinDistance,
  });
  return s;
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
  const r = s.arenaId ? C.obstacleRadius : C.playerRadius;
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
    speed:
      p.status === "trapped"
        ? C.movementTilesPerSecond * C.trappedSpeedMultiplier
        : p.speed + (power ? C.powerSpeedBonus : 0),
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
  else if (kind === "range") {
    if (p.range < C.maxRange) {
      p.rangePickups =
        (p.rangePickups ?? Math.max(0, p.range - C.initialRange)) + 1;
      p.range++;
    }
  } else if (kind === "speed")
    p.speed = Math.min(C.maxSpeed, p.speed + C.speedIncrement);
  else if (kind === "ultra") {
    p.rangePickups ??= Math.max(0, p.range - C.initialRange);
    p.ultraPickup = true;
    p.range = C.maxRange;
  } else {
    while (p.inventory.length >= C.inventoryLimit) p.inventory.shift();
    p.inventory.push(kind);
  }
  return true;
}

export function movePlayer(
  s: PracticeState,
  p: PracticePlayer,
  raw: LocalInput,
  dt: number,
  interact = true,
) {
  if (s.arenaId) {
    moveCardinal(s, p, raw, dt);
    return;
  }
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
  const target = {
    x: Math.floor(oldX + dx + Math.sign(x) * C.playerRadius),
    y: Math.floor(oldY + dy + Math.sign(y) * C.playerRadius),
  };
  const obstacle = s.balloons.find(
    (b) =>
      b.x === target.x && b.y === target.y && !b.passThrough.includes(p.id),
  );
  if (
    interact &&
    obstacle &&
    p.status === "active" &&
    ((p.gloveUntil ?? 0) > s.time || (p.shoesUntil ?? 0) > s.time)
  ) {
    const stepX = Math.abs(x) >= Math.abs(y) ? Math.sign(x) : 0;
    const stepY = stepX ? 0 : Math.sign(y);
    const reach = (p.gloveUntil ?? 0) > s.time ? 2 : 1;
    const tx = obstacle.x + stepX * reach,
      ty = obstacle.y + stepY * reach;
    if (
      (stepX || stepY) &&
      s.map[ty]?.[tx] === "floor" &&
      !s.balloons.some((b) => b.x === tx && b.y === ty) &&
      (reach === 2 || s.map[ty]?.[tx] === "floor")
    ) {
      obstacle.x = tx;
      obstacle.y = ty;
      obstacle.passThrough = [];
    }
  }
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
  // Walking is an animation intent, even when collision prevents displacement.
  p.moving = Boolean(x || y) || p.position.x !== oldX || p.position.y !== oldY;
}

/** Cardinal free movement: tiles constrain obstacles, not turn positions. */
function moveCardinal(
  s: PracticeState,
  p: PracticePlayer,
  raw: LocalInput,
  dt: number,
) {
  p.moveTarget = undefined;
  p.queuedTurn = undefined;
  p.queuedTurnRemainingMs = undefined;
  if (raw.turnId !== undefined) p.lastTurnId = raw.turnId;
  let x = Number.isFinite(raw.x) ? Math.sign(raw.x) : 0;
  let y = Number.isFinite(raw.y) ? Math.sign(raw.y) : 0;
  // Keyboard sends only its newest held direction. Also sanitize dual-axis packets.
  if (x && y) {
    if (p.facing === "left" || p.facing === "right") y = 0;
    else x = 0;
  }
  p.moving = Boolean(x || y);
  if (!p.moving) return;
  p.facing = x ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up";
  let remaining = (effectiveStats(s, p).speed * dt) / 1000;
  // Small swept increments keep high speeds/large prediction steps from tunneling.
  let blocked = false;
  while (remaining > 1e-8) {
    const step = Math.min(remaining, 0.05);
    const nx = p.position.x + x * step,
      ny = p.position.y + y * step;
    if (!canOccupy(s, p, nx, ny)) {
      blocked = true;
      break;
    }
    p.position = { x: nx, y: ny };
    remaining -= step;
  }
  // If forward travel occurred, don't add sideways movement in the same tick.
  // A blocked, slightly off-center character can align first, then advance on
  // a later tick. This is an orthogonal nudge, never a diagonal shortcut.
  if (!blocked || remaining < (effectiveStats(s, p).speed * dt) / 1000 - 1e-8)
    return;
  const lateral = x ? p.position.y : p.position.x;
  const clearance = 0.5 - C.obstacleRadius - 1e-6;
  const probe = Math.min(remaining, 0.05);
  // Search both neighboring lanes too: the body may straddle the tile edge.
  const lanes = [-1, 0, 1]
    .map((delta) => {
      const center = Math.floor(lateral) + 0.5 + delta;
      return Math.max(
        center - clearance,
        Math.min(center + clearance, lateral),
      );
    })
    .filter(
      (lane) =>
        Math.abs(lane - lateral) > 1e-8 &&
        Math.abs(lane - lateral) <= C.cornerSlideMaxDistance,
    )
    .sort((a, b) => Math.abs(a - lateral) - Math.abs(b - lateral));
  for (const lane of lanes) {
    const clear = (v: number, forward: number) =>
      canOccupy(
        s,
        p,
        x ? p.position.x + x * forward : v,
        y ? p.position.y + y * forward : v,
      );
    if (!clear(lane, probe)) continue;
    // Validate the entire lateral route, not just the destination.
    const offset = lane - lateral;
    const count = Math.ceil(Math.abs(offset) / 0.05);
    let safe = true;
    for (let i = 1; i <= count; i++)
      if (!clear(lateral + (offset * i) / count, 0)) {
        safe = false;
        break;
      }
    if (!safe) continue;
    const next =
      lateral + Math.sign(offset) * Math.min(Math.abs(offset), remaining, 0.05);
    if (x) p.position.y = next;
    else p.position.x = next;
    break;
  }
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
    skinId: p.balloonSkinId ?? 0,
    id: s.nextId++,
    owner: p.id,
    x,
    y,
    range: effectiveStats(s, p).range,
    explodesAt: s.time + C.balloonFuseMs,
    passThrough: s.players
      .filter(
        (other) =>
          other.status === "active" &&
          overlapsCell(
            other.position,
            { x, y },
            s.arenaId ? C.obstacleRadius : C.playerRadius,
          ),
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
      const kind = rollCrateItem(random(s));
      s.items.push({
        id: s.nextId++,
        kind,
        x,
        y,
        availableAt: s.time + C.blastMs,
        expiresAt: s.time + C.itemLifetimeMs,
      });
    }
  }
}

export function inBlast(s: PracticeState, position: Position) {
  return s.blasts.some((b) =>
    b.cells.some((cell) => overlapsCell(position, cell)),
  );
}

/** One authoritative death path for drowning and monster contact. Used items are not duplicated. */
export function defeatPlayer(s: PracticeState, p: PracticePlayer) {
  if (p.status === "respawning") return;
  const drops: ItemKind[] = [...p.inventory];
  for (let n = C.initialBalloons; n < Math.min(p.capacity, C.maxBalloons); n++)
    drops.push("balloon");
  const speedSteps = Math.max(
    0,
    Math.round(
      (Math.min(p.speed, C.maxSpeed) - C.movementTilesPerSecond) /
        C.speedIncrement,
    ),
  );
  for (let n = 0; n < speedSteps; n++) drops.push("speed");
  const fluids = p.rangePickups ?? Math.max(0, p.range - C.initialRange);
  for (let n = 0; n < fluids; n++) drops.push("range");
  if (p.ultraPickup) drops.push("ultra");
  // Sample the retained upgrades/unused inventory, never recreate consumed items.
  for (let n = drops.length - 1; n > 0; n--) {
    const j = Math.floor(random(s) * (n + 1));
    [drops[n], drops[j]] = [drops[j], drops[n]];
  }
  if (drops.length > 3)
    drops.length = Math.floor(drops.length * C.deathDropRatio);
  if (drops.length) {
    const floors: Position[] = [];
    for (let y = s.arenaId ? 0 : 1; y < C.rows - (s.arenaId ? 0 : 1); y++)
      for (let x = s.arenaId ? 0 : 1; x < C.columns - (s.arenaId ? 0 : 1); x++)
        if (
          s.map[y][x] === "floor" &&
          (!s.round || teamCanUseCell(s, p.team, x))
        )
          floors.push({ x, y });
    const preferred = floors.filter(
      (pos) =>
        !s.items.some((i) => i.x === pos.x && i.y === pos.y) &&
        !s.balloons.some((b) => b.x === pos.x && b.y === pos.y) &&
        !inBlast(s, { x: pos.x + 0.5, y: pos.y + 0.5 }) &&
        !s.players.some(
          (other) =>
            sameCell(pos, other.spawn) ||
            (other.status === "active" && sameCell(pos, other.position)),
        ),
    );
    const candidates = preferred.length >= drops.length ? preferred : floors;
    const pool = [...candidates];
    for (let n = pool.length - 1; n > 0; n--) {
      const j = Math.floor(random(s) * (n + 1));
      [pool[n], pool[j]] = [pool[j], pool[n]];
    }
    drops.forEach((kind, index) => {
      const pos = pool[index % pool.length];
      if (pos)
        s.items.push({
          id: s.nextId++,
          kind,
          ...pos,
          flight: {
            from: { ...p.position },
            startedAt: s.time,
            landsAt: s.time + 700 + index * 45,
          },
          availableAt: s.time + C.respawnMs + C.deathDropPickupDelayMs,
          expiresAt: s.time + 700 + index * 45 + C.itemLifetimeMs,
        });
    });
  }
  p.inventory = [];
  p.moveTarget = undefined;
  p.queuedTurn = undefined;
  p.queuedTurnRemainingMs = undefined;
  p.capacity = C.initialBalloons;
  p.range = C.initialRange;
  p.rangePickups = 0;
  p.ultraPickup = false;
  p.speed = p.practiceOpponent
    ? C.practiceOpponentTilesPerSecond
    : C.movementTilesPerSecond;
  p.shieldUntil = p.powerUntil = p.gloveUntil = p.shoesUntil = p.ghostUntil = 0;
  p.invulnerableUntil = 0;
  p.pickupBlockedUntil = 0;
  p.status = "respawning";
  p.statusUntil = s.time + C.respawnMs;
  p.moving = false;
  p.deaths++;
}

function respawn(s: PracticeState, p: PracticePlayer) {
  const candidates: Position[] = [];
  const valid = s.arenaId
    ? new Set(
        arenaSpawnCells(s.map).map(
          (pos) => `${Math.floor(pos.x)},${Math.floor(pos.y)}`,
        ),
      )
    : null;
  for (let y = s.arenaId ? 0 : 1; y < C.rows - (s.arenaId ? 0 : 1); y++)
    for (let x = s.arenaId ? 0 : 1; x < C.columns - (s.arenaId ? 0 : 1); x++) {
      if (
        teamCanUseCell(s, p.team, x) &&
        s.map[y][x] === "floor" &&
        (!valid || valid.has(`${x},${y}`))
      )
        candidates.push({ x: x + 0.5, y: y + 0.5 });
    }
  const safeCells = candidates.filter(
    (pos) =>
      canOccupy(s, p, pos.x, pos.y) &&
      !s.items.some((item) => sameCell(pos, item)) &&
      !s.balloons.some((b) => sameCell(pos, b)) &&
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
  const safe = safeCells[Math.floor(random(s) * safeCells.length)];
  if (safe) {
    p.position = safe;
    p.moveTarget = undefined;
    p.queuedTurn = undefined;
    p.queuedTurnRemainingMs = undefined;
    p.status = "active";
    p.invulnerableUntil = s.time + C.invulnerableMs;
    p.pickupBlockedUntil = s.time + C.deathDropPickupDelayMs;
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
      defeatPlayer(s, p);
    }
    if (p.status === "respawning" && s.time >= p.statusUntil) respawn(s, p);
    if (p.status === "active" || p.status === "trapped") {
      movePlayer(s, p, input, dt);
      // Remove the pass-through permission once the entire body has left the cell.
      for (const b of s.balloons)
        if (
          !overlapsCell(
            p.position,
            b,
            s.arenaId ? C.obstacleRadius : C.playerRadius,
          )
        )
          b.passThrough = b.passThrough.filter((id) => id !== p.id);
      if (p.status === "active" && input.balloon && !p.bombDown)
        placeBalloon(s, p);
    }
    p.bombDown = Boolean(input.balloon);
  }
  s.items = s.items.filter((item) => {
    item.expiresAt ??= (item.flight?.landsAt ?? s.time) + C.itemLifetimeMs;
    return s.time < item.expiresAt;
  });
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
    if (p.practiceOpponent || s.time < (p.pickupBlockedUntil ?? 0)) continue;
    s.items = s.items.filter((item) => {
      if (item.availableAt > s.time || !sameCell(p.position, item)) return true;
      return !collectItem(p, item.kind);
    });
  }
}

/** Fixed-step simulation; accepts elapsed milliseconds and has no browser dependency. */
export function stepPractice(
  s: PracticeState,
  inputs: readonly LocalInput[] | (() => readonly LocalInput[]),
  elapsedMs: number,
) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
  if (s.round?.phase === "FINISHED") return;
  s.accumulator += elapsedMs;
  while (s.accumulator + 1e-7 >= C.fixedStepMs) {
    tick(s, typeof inputs === "function" ? inputs() : inputs);
    s.accumulator -= C.fixedStepMs;
    if (s.round && s.time >= s.round.durationMs) {
      s.accumulator = 0;
      break;
    }
  }
}
