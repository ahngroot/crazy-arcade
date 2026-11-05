import { expect, it } from "vitest";
import { startCue } from "./countdown";

it("shows one second each of 3, 2, 1 and Game Start, then disappears", () => {
  for (const [at, expected] of [
    [-10, "3"],
    [0, "3"],
    [999, "3"],
    [1000, "2"],
    [1999, "2"],
    [2000, "1"],
    [2999, "1"],
    [3000, "Game Start!"],
    [3999, "Game Start!"],
    [4000, null],
  ] as const)
    expect(startCue(at)).toBe(expected);
});
