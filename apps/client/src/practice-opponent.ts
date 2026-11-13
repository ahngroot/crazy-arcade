import {
  arenaSpawnCells,
  canOccupy,
  EMPTY_INPUT,
  effectiveStats,
  GAME_CONFIG as C,
  type PracticeState,
  type LocalInput,
  type Position,
  type PracticePlayer,
  type Balloon,
} from "@bubble/shared";

export function addPracticeOpponent(s: PracticeState) {
  const player = s.players[0];
  const cells = arenaSpawnCells(s.map).filter(
    (p) => Math.hypot(p.x - player.position.x, p.y - player.position.y) > 3,
  );
  const spawn = cells.sort(
    (a, b) =>
      Math.hypot(b.x - player.position.x, b.y - player.position.y) -
      Math.hypot(a.x - player.position.x, a.y - player.position.y),
  )[0];
  if (!spawn) throw Error("Practice arena has no separate opponent spawn");
  s.players.push({
    ...player,
    id: "practice-pirate",
    team: "green",
    characterId: undefined,
    practiceOpponent: true,
    speed: C.practiceOpponentTilesPerSecond,
    position: { ...spawn },
    spawn: { ...spawn },
    inventory: [],
  });
}

const cellKey = (p: Position) => `${Math.floor(p.x)},${Math.floor(p.y)}`;
const neighbors = (p: Position) =>
  [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ].map(([x, y]) => ({ x: p.x + x, y: p.y + y }));
function blastCells(s: PracticeState, b: Pick<Balloon, "x" | "y" | "range">) {
  const cells: Position[] = [{ x: b.x, y: b.y }];
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ])
    for (let i = 1; i <= b.range; i++) {
      const x = b.x + dx * i,
        y = b.y + dy * i,
        tile = s.map[y]?.[x];
      if (!tile || tile === "wall") break;
      cells.push({ x, y });
      if (tile === "crate") break;
    }
  return cells;
}
/** Conservative future water coverage, including early chain reactions. */
function hazards(s: PracticeState, extra?: Balloon) {
  const bombs = extra ? [...s.balloons, extra] : s.balloons;
  const areas = bombs.map((b) => blastCells(s, b));
  const times = bombs.map((b) =>
    s.blasts.some((blast) =>
      blast.cells.some((c) => c.x === b.x && c.y === b.y),
    )
      ? s.time
      : b.explodesAt,
  );
  for (let pass = 0; pass < bombs.length; pass++) {
    let changed = false;
    bombs.forEach((b, i) =>
      bombs.forEach((other, j) => {
        if (
          times[i] < times[j] &&
          areas[i].some((c) => c.x === other.x && c.y === other.y)
        ) {
          times[j] = times[i];
          changed = true;
        }
      }),
    );
    if (!changed) break;
  }
  const danger = new Map<string, number>();
  areas.forEach((cells, i) =>
    cells.forEach((c) =>
      danger.set(
        cellKey(c),
        Math.min(danger.get(cellKey(c)) ?? Infinity, times[i]),
      ),
    ),
  );
  for (const blast of s.blasts)
    for (const c of blast.cells) danger.set(cellKey(c), s.time);
  return danger;
}
function search(
  s: PracticeState,
  p: PracticePlayer,
  goal: (n: Position) => boolean,
  allowed: (n: Position) => boolean,
) {
  const start = { ...p.position },
    queue = [{ pos: start, path: [] as Position[] }],
    seen = new Set([cellKey(start)]);
  for (const node of queue) {
    if (goal(node.pos)) return node.path;
    for (const n of neighbors(node.pos)) {
      const key = cellKey(n);
      if (seen.has(key) || !canOccupy(s, p, n.x, n.y) || !allowed(n)) continue;
      seen.add(key);
      queue.push({ pos: n, path: [...node.path, n] });
    }
  }
  return undefined;
}
function escape(
  s: PracticeState,
  p: PracticePlayer,
  danger: Map<string, number>,
) {
  const path = search(
    s,
    p,
    (n) => !danger.has(cellKey(n)),
    () => true,
  );
  if (!path?.length) return undefined;
  const deadline = Math.min(
    ...[p.position, ...path].map((n) => danger.get(cellKey(n)) ?? Infinity),
  );
  // Reach a completely dry cell before the earliest possible blast on the route.
  if (
    s.time + (path.length / effectiveStats(s, p).speed) * 1000 + 350 >=
    deadline
  )
    return undefined;
  return path;
}

/** Practice AI uses exactly the normal movement, pickup, item and balloon rules. */
export function roamingOpponent() {
  let target: Position | undefined,
    origin: Position | undefined,
    previous: Position | undefined;
  let lastTick = -1,
    nextPlantAt = 800;
  const visits = new Map<string, number>();
  return (s: PracticeState): LocalInput => {
    const p = s.players.find((p) => p.practiceOpponent);
    if (!p) return EMPTY_INPUT;
    if (s.tick < lastTick) {
      target = origin = previous = undefined;
      nextPlantAt = 800;
      visits.clear();
    }
    lastTick = s.tick;
    if (p.status !== "active") {
      target = origin = previous = p.practiceTarget = undefined;
      return {
        ...EMPTY_INPUT,
        useItem:
          p.status === "trapped" && p.inventory[0] === "needle" && !p.itemDown,
      };
    }
    if (target && origin && !canOccupy(s, p, target.x, target.y))
      target = { ...origin };
    if (
      target &&
      Math.hypot(target.x - p.position.x, target.y - p.position.y) < 1e-6
    ) {
      previous = origin;
      target = undefined;
    }
    let useItem = false;
    if (!target) {
      const here = { ...p.position },
        key = cellKey(here),
        danger = hazards(s);
      visits.set(key, (visits.get(key) ?? 0) + 1);
      useItem = p.inventory[0] === "shield" && danger.has(key) && !p.itemDown;
      if (danger.has(key)) target = escape(s, p, danger)?.[0];
      else {
        const stats = effectiveStats(s, p);
        const hypothetical: Balloon = {
          id: -1,
          owner: p.id,
          x: Math.floor(here.x),
          y: Math.floor(here.y),
          range: stats.range,
          explodesAt: s.time + C.balloonFuseMs,
          passThrough: [p.id],
        };
        const area = blastCells(s, hypothetical);
        const useful = area.some(
          (c) =>
            s.map[c.y]?.[c.x] === "crate" ||
            s.players.some(
              (other) =>
                other.id !== p.id &&
                other.status === "active" &&
                cellKey(other.position) === cellKey(c),
            ),
        );
        if (
          s.time >= nextPlantAt &&
          !p.bombDown &&
          s.balloons.filter((b) => b.owner === p.id).length < stats.capacity &&
          !s.balloons.some((b) => cellKey(b) === key) &&
          useful
        ) {
          const route = escape(s, p, hazards(s, hypothetical));
          if (route) {
            target = route[0];
            origin = here;
            p.practiceTarget = undefined;
            nextPlantAt = s.time + 1800;
            return { ...EMPTY_INPUT, balloon: true };
          }
        }
        const itemCells = new Set(
          s.items.filter((item) => item.availableAt <= s.time).map(cellKey),
        );
        target = search(
          s,
          p,
          (n) => itemCells.has(cellKey(n)),
          (n) => !danger.has(cellKey(n)),
        )?.[0];
        if (!target) {
          const choices = neighbors(here).filter(
            (n) => canOccupy(s, p, n.x, n.y) && !danger.has(cellKey(n)),
          );
          choices.sort(
            (a, b) =>
              (visits.get(cellKey(a)) ?? 0) - (visits.get(cellKey(b)) ?? 0) ||
              Number(!!previous && cellKey(a) === cellKey(previous)) -
                Number(!!previous && cellKey(b) === cellKey(previous)),
          );
          target = choices[0];
        }
      }
      origin = here;
    }
    p.practiceTarget = target;
    if (!target) return { ...EMPTY_INPUT, useItem };
    const dx = target.x - p.position.x,
      dy = target.y - p.position.y;
    return {
      x: Math.abs(dx) > 1e-6 ? Math.sign(dx) : 0,
      y: Math.abs(dx) > 1e-6 ? 0 : Math.sign(dy),
      balloon: false,
      useItem,
    };
  };
}
