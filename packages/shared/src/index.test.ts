import { describe, expect, it } from "vitest";
import { createPreviewMap, GAME_CONFIG } from "./index";
describe("preview map contract", () => {
  it("creates a symmetric 15 by 13 arena with separated teams and clear spawns", () => {
    const map = createPreviewMap();
    expect(map).toHaveLength(GAME_CONFIG.rows);
    for (const row of map) {
      expect(row).toHaveLength(GAME_CONFIG.columns);
      expect(row).toEqual([...row].reverse());
      expect(row[7]).toBe("wall");
    }
    expect(map[1][1]).toBe("floor");
    expect(map[1][13]).toBe("floor");
  });
  it("returns independent map data for each scene", () => {
    const first = createPreviewMap();
    first[1][1] = "crate";
    expect(createPreviewMap()[1][1]).toBe("floor");
  });
});
