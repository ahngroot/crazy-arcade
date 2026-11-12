import {
  arenaSpawnCells,
  canOccupy,
  EMPTY_INPUT,
  GAME_CONFIG as C,
  type PracticeState,
  type LocalInput,
  type Position,
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

/** Local, movement-only bot. Decisions run on each simulation tick, not frames. */
export function roamingOpponent() {
  let target: Position | undefined, origin: Position | undefined;
  let previous: Position | undefined,
    lastTick = -1,
    turns = 0;
  return (s: PracticeState): LocalInput => {
    const p = s.players.find((p) => p.practiceOpponent);
    if (!p || p.status !== "active") {
      target = origin = previous = undefined;
      return EMPTY_INPUT;
    }
    if (s.tick < lastTick) target = origin = previous = undefined;
    lastTick = s.tick;
    if (target && origin && !canOccupy(s, p, target.x, target.y))
      target = { ...origin };
    if (
      target &&
      Math.hypot(target.x - p.position.x, target.y - p.position.y) < 1e-6
    ) {
      previous = origin;
      target = undefined;
    }
    if (!target) {
      const here = { ...p.position };
      const choices = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]
        .map(([x, y]) => ({ x: here.x + x, y: here.y + y }))
        .filter((n) => canOccupy(s, p, n.x, n.y));
      const forward = choices.filter(
        (n) =>
          !previous || Math.hypot(n.x - previous.x, n.y - previous.y) > 0.1,
      );
      const options = forward.length ? forward : choices;
      target = options[(turns++ + (s.seed >>> 16)) % options.length];
      origin = here;
    }
    if (!target) return EMPTY_INPUT;
    p.speed = C.practiceOpponentTilesPerSecond;
    const dx = target.x - p.position.x,
      dy = target.y - p.position.y;
    return {
      x: Math.abs(dx) > 1e-6 ? Math.sign(dx) : 0,
      y: Math.abs(dx) > 1e-6 ? 0 : Math.sign(dy),
      balloon: false,
      useItem: false,
    };
  };
}
