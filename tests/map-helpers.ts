import { expect, type Page } from "@playwright/test";
import { ARENAS, arenaById, createArenaMap } from "@bubble/shared";

export async function readPosition(page: Page, id = "p1") {
  const panel = page.locator(`[data-player=${id}]`);
  return panel.evaluate((node: HTMLElement) => ({
    x: Number(node.dataset.x),
    y: Number(node.dataset.y),
  }));
}
export async function currentMap(page: Page) {
  const id = await page.locator("#game-arena").getAttribute("data-map-id");
  expect(ARENAS.map((a) => a.id)).toContain(id);
  return createArenaMap(arenaById(id!)!);
}
export async function assertEmptySpawn(page: Page, id = "p1") {
  await expect
    .poll(
      async () => {
        const snapshot = await page.evaluate((id) => {
          const panel = document.querySelector<HTMLElement>(
            `[data-player=${id}]`,
          );
          return {
            id: document.querySelector<HTMLElement>("#game-arena")?.dataset
              .mapId,
            label: document.querySelector("#current-map")?.textContent,
            pos: panel ? { x: panel.dataset.x, y: panel.dataset.y } : null,
          };
        }, id);
        const arena = arenaById(snapshot.id);
        if (!arena || !snapshot.pos || snapshot.label !== `맵 · ${arena.name}`)
          return false;
        return (
          createArenaMap(arena)[Math.floor(Number(snapshot.pos.y))]?.[
            Math.floor(Number(snapshot.pos.x))
          ] === "floor"
        );
      },
      { intervals: [16] },
    )
    .toBe(true);
  const map = await currentMap(page),
    pos = await readPosition(page, id);
  expect(map[Math.floor(pos.y)]?.[Math.floor(pos.x)]).toBe("floor");
  return pos;
}
export async function freeDirection(page: Page, id = "p1") {
  const map = await currentMap(page),
    pos = await readPosition(page, id);
  const x = Math.floor(pos.x),
    y = Math.floor(pos.y);
  const [dx, dy] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ].find(([dx, dy]) => map[y + dy]?.[x + dx] === "floor")!;
  const axis: "x" | "y" = dx ? "x" : "y",
    sign = dx || dy;
  return {
    axis,
    sign,
    key: dx
      ? dx > 0
        ? "ArrowRight"
        : "ArrowLeft"
      : dy > 0
        ? "ArrowDown"
        : "ArrowUp",
    from: pos[axis],
  };
}
export async function moveSome(page: Page, id = "p1", distance = 0.35) {
  const direction = await freeDirection(page, id);
  await page.keyboard.down(direction.key);
  try {
    await expect
      .poll(
        async () =>
          direction.sign *
          ((await readPosition(page, id))[direction.axis] - direction.from),
        { intervals: [25], timeout: 4000 },
      )
      .toBeGreaterThan(distance);
  } finally {
    await page.keyboard.up(direction.key);
  }
  return direction;
}
/** Walk only through visible empty cells to a destructible block, independent of random start. */
export async function walkToCrate(page: Page) {
  const map = await currentMap(page),
    start = await readPosition(page);
  const root = { x: Math.floor(start.x), y: Math.floor(start.y) },
    queue = [{ ...root, path: [] as { x: number; y: number }[] }],
    seen = new Set<string>();
  let path: { x: number; y: number }[] | undefined;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i],
      key = `${p.x},${p.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const neighbors = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }));
    if (neighbors.some((n) => map[n.y]?.[n.x] === "crate")) {
      path = p.path;
      break;
    }
    for (const n of neighbors)
      if (map[n.y]?.[n.x] === "floor" && !seen.has(`${n.x},${n.y}`))
        queue.push({ ...n, path: [...p.path, n] });
  }
  expect(
    path,
    "reachable floor component should border a destructible block",
  ).toBeDefined();
  for (const target of path!) {
    const pos = await readPosition(page),
      axis: "x" | "y" = Math.abs(target.x + 0.5 - pos.x) > 0.5 ? "x" : "y";
    const destination = target[axis] + 0.5,
      sign = Math.sign(destination - pos[axis]);
    const key =
      axis === "x"
        ? sign > 0
          ? "ArrowRight"
          : "ArrowLeft"
        : sign > 0
          ? "ArrowDown"
          : "ArrowUp";
    await page.keyboard.down(key);
    try {
      await expect
        .poll(
          async () => sign * ((await readPosition(page))[axis] - destination),
          { intervals: [16], timeout: 3000 },
        )
        .toBeGreaterThan(-0.08);
    } finally {
      await page.keyboard.up(key);
    }
  }
}
