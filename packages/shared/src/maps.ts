import type { Position, PracticeState, Team, Tile } from "./index.js";

/** Data-only catalogue. Add a row layout here to add it to both modes' random rotation. */
export interface ArenaDefinition {
  id: string;
  name: string;
  theme: number;
  rows: readonly string[];
  decorations?: readonly {
    kind: "lion" | "mast" | "pond";
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}
// . = open floor, r = alternate floor/road. b/c/t = breakable blocks.
// w/h/d = fixed obstacles. m/p = fixed landmark footprint (drawn as a larger sprite).
export const ARENAS: readonly ArenaDefinition[] = [
  {
    id: "pirate-lion",
    name: "해적선 · 사자 문양",
    theme: 0,
    rows: [
      "bccbbtttttbbcbb",
      "bwbbbbbbbbbbbwb",
      "bbbbc....bbccbb",
      "bbcbb.....bccbb",
      "ttbb.......bbtt",
      "bbbb.......bbbb",
      "ttcc.......bbtt",
      "bbbb.......bbbb",
      "ttbbc......bbtt",
      "bbbbbbbbbbbcbbb",
      "bdccbbbbbcbbbdb",
      "bbcccbccbbbbbbb",
      "bbthbbttbbhttbb",
    ],
    decorations: [{ kind: "lion", x: 4, y: 2, width: 7, height: 7 }],
  },
  {
    id: "pirate-mast",
    name: "해적선 · 중앙 돛대",
    theme: 1,
    rows: [
      "bbbb...b...bbbb",
      "bwb.cccbccc.bwb",
      "bbbcb.bcb.b.bbb",
      "b.cb.bbm.bb.c.b",
      "b.cb.bbmbbb.c.b",
      "b.cb.bmmm.bcb.b",
      "b.cb.bmmm.bcb.b",
      "bbbcbbbbbbbcbbb",
      "bbbbcb.b.bcbbbb",
      "bbbbbcbcbccbbbb",
      "bbb.b.bcb.b.bbb",
      "bwb.b.bbb.b.bwb",
      "b...b..b..b...b",
    ],
    decorations: [{ kind: "mast", x: 5, y: 2, width: 5, height: 5 }],
  },
  {
    id: "toy-village",
    name: "블록 마을",
    theme: 2,
    rows: [
      ".tbtbwrcrw.bh.h",
      ".hchcwcrrwbbt..",
      ".tbtbwrccwhchch",
      "chchcvcrrvbbtbb",
      "btbtbwrrcw.hchh",
      ".hchcwccrwbtbtb",
      "w.....rrc.....w",
      "btbtbwcrrwbtbtb",
      "dcdcdwrccwhchch",
      "btbtbvccrvbtbtb",
      "d.dcdwcrrw.hch.",
      "btbtbwrrcwchchb",
      "dcdcdwccrwbtb..",
    ],
  },
  {
    id: "gem-mine",
    name: "보석 광산",
    theme: 3,
    rows: [
      "w.wwbbwbwbbw..w",
      ".hhbcb...cbhh..",
      "bhhbbtbwbdbhhtb",
      "b.bbbbcbbbbb.bb",
      "wdbdbbwbbwbbwtb",
      "bbbbbbbbbbbbbbb",
      "t.wbwbwbwbwbb.w",
      ".bbbbbwbbbbb.b.",
      "bdwbwbbwbdbwbtw",
      "bbbbbbbbbbbbbbb",
      "b.hhbbbwb.bhh.b",
      ".bhhbtb.bdbhh.b",
      ".wtbbbwbbwbtw..",
    ],
  },
  {
    id: "container-factory",
    name: "컨테이너 공장",
    theme: 4,
    rows: [
      "wwwwbbbwwbbbwww",
      "wr.rtrtrtrtrtrw",
      "bbbbbb...bbbbbb",
      "wdwdw.w.wdwdwdw",
      "bbbbbbwbbbbbbbb",
      "wrtrtrbdrtrtrrw",
      ".hbbbbwbwbbbbh.",
      "bbwbwbbwbwbbbbb",
      "hbw.bbt.btbb.wh",
      "bbbbbbwbbbbbbbb",
      ".hbbwrbtrbbbh..",
      "bbwbwbwbwbwbwbb",
      "wwwbbbbbbbbwwww",
    ],
  },
  {
    id: "moss-forest",
    name: "이끼 숲",
    theme: 5,
    rows: [
      ".dbcbdbcbdbcbdb",
      ".bc..bc..bc..bc",
      "bdbwbwbdbwbwbdb",
      ".bc..bc..bc..bc",
      "bcbcbcbcbcbcbcb",
      ".wbwbwbwbwbwbwb",
      "bcbcbcbctdbcbcb",
      ".dbwbwbwbwbwbdb",
      "bcbcbcbcbcbcbcb",
      ".dbwbwbwbwbwbdb",
      "bcbctcbcbcbcbcb",
      ".db..wb..wb.ppp",
      "bcb.bcb.bcb.ppp",
    ],
    decorations: [{ kind: "pond", x: 12, y: 11, width: 3, height: 2 }],
  },
  {
    id: "ancient-ruins",
    name: "고대 유적",
    theme: 6,
    rows: [
      "bw..w.bdb.w..wb",
      "bw..w.bhb.w..wb",
      "bw..w.bhb.w..wb",
      "b.....bht......",
      "bw..w.tbt.w..wb",
      "bw..w.tht.w..wb",
      "bw..w.bhb.w..wb",
      "bw..w.bhb.w..wb",
      "bw..w.bhb.w..wb",
      "......bdb.....b",
      "bw..w.bbb.w..wb",
      "bw..w.bbb.w..wb",
      "bw..w.bbb.w..wb",
    ],
  },
];

export function arenaById(id: string | undefined) {
  return ARENAS.find((arena) => arena.id === id);
}
export function arenaTile(glyph: string): Tile {
  if (".r".includes(glyph)) return "floor";
  if ("bctv".includes(glyph)) return "crate";
  if ("whdmp".includes(glyph)) return "wall";
  throw new Error(`Unknown arena glyph: ${glyph}`);
}
export function createArenaMap(arena: ArenaDefinition): Tile[][] {
  if (arena.rows.length !== 13 || arena.rows.some((row) => row.length !== 15))
    throw new Error(`Invalid arena dimensions: ${arena.id}`);
  return arena.rows.map((row) => [...row].map(arenaTile));
}
/** Shared arenas have no artificial red/green half restriction. Legacy rule fixtures keep it. */
export function teamCanUseCell(
  s: Pick<PracticeState, "arenaId">,
  team: Team,
  x: number,
) {
  return Boolean(s.arenaId) || (team === "red" ? x < 7 : x > 7);
}
const neighbors = (pos: Position) =>
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].map(([dx, dy]) => ({ x: pos.x + dx, y: pos.y + dy }));
export function arenaSpawnCells(map: readonly Tile[][]): Position[] {
  const floors: Position[] = [];
  map.forEach((row, y) =>
    row.forEach((tile, x) => {
      if (
        y > 0 &&
        tile === "floor" &&
        neighbors({ x, y }).filter((n) => map[n.y]?.[n.x] === "floor").length >=
          1
      )
        floors.push({ x: x + 0.5, y: y + 0.5 });
    }),
  );
  const groups = new Map<string, Position[]>();
  let best: Position[] = [];
  for (const pos of floors) {
    const key = `${Math.floor(pos.x)},${Math.floor(pos.y)}`;
    if (groups.has(key)) continue;
    const component = reachableArenaCells(map, pos);
    const group = floors.filter((p) =>
      component.has(`${Math.floor(p.x)},${Math.floor(p.y)}`),
    );
    for (const k of component) groups.set(k, group);
    if (group.length > best.length) best = group;
  }
  return best;
}
export function reachableArenaCells(
  map: readonly Tile[][],
  origin: Position,
): Set<string> {
  const queue = [{ x: Math.floor(origin.x), y: Math.floor(origin.y) }],
    seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i],
      key = `${p.x},${p.y}`;
    if (seen.has(key) || !map[p.y]?.[p.x] || map[p.y][p.x] === "wall") continue;
    seen.add(key);
    for (const next of neighbors(p))
      if (!seen.has(`${next.x},${next.y}`)) queue.push(next);
  }
  return seen;
}
export function configureArena(
  s: PracticeState,
  rng: () => number,
  options: { previousId?: string; id?: string; minSpawnDistance?: number } = {},
) {
  const choices = ARENAS.filter((arena) => arena.id !== options.previousId);
  const arena = options.id
    ? arenaById(options.id)
    : choices[Math.floor(rng() * choices.length)];
  if (!arena) throw new Error("Unknown arena");
  s.map = createArenaMap(arena);
  s.mapRevision = 0;
  s.arenaId = arena.id;
  s.terrain = "themed";
  const cells = arenaSpawnCells(s.map);
  const used: Position[] = [];
  for (const player of s.players) {
    const free = cells.filter(
      (pos) => !used.some((p) => p.x === pos.x && p.y === pos.y),
    );
    const distant = free.filter((pos) =>
      used.every(
        (p) =>
          Math.hypot(p.x - pos.x, p.y - pos.y) >=
          (options.minSpawnDistance ?? 4),
      ),
    );
    const pool = distant.length ? distant : free;
    const pos = pool[Math.floor(rng() * pool.length)];
    if (!pos) throw new Error(`Not enough spawn cells: ${arena.id}`);
    used.push(pos);
    player.position = { ...pos };
    player.spawn = { ...pos };
  }
}
