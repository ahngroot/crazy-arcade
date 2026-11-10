import { expect, it } from "vitest";
import {
  BALLOON_SKIN_COUNT,
  createPractice,
  isBalloonSkinId,
  placeBalloon,
  stepPractice,
  EMPTY_INPUT,
  GAME_CONFIG as C,
  defeatPlayer,
} from "./index";

it("keeps each balloon's cosmetic choice without changing placement, fuse, range or death reset", () => {
  for (let id = 0; id < BALLOON_SKIN_COUNT; id++) {
    const s = createPractice();
    const p = s.players[0];
    p.balloonSkinId = id;
    expect(placeBalloon(s, p)).toBe(true);
    const b = s.balloons[0];
    expect(b).toMatchObject({
      skinId: id,
      owner: p.id,
      range: C.initialRange,
      explodesAt: C.balloonFuseMs,
    });
    // A placed balloon keeps its original appearance if the owner's choice changes.
    p.balloonSkinId = 0;
    stepPractice(s, [EMPTY_INPUT], C.fixedStepMs);
    expect(b.skinId).toBe(id);
    p.balloonSkinId = id;
    defeatPlayer(s, p);
    expect(p.balloonSkinId).toBe(id);
    expect([p.speed, p.capacity, p.range]).toEqual([
      C.movementTilesPerSecond,
      C.initialBalloons,
      C.initialRange,
    ]);
  }
});
it("accepts only integer cosmetic IDs and defaults older players to the existing balloon", () => {
  for (const invalid of [
    -1,
    BALLOON_SKIN_COUNT,
    0.5,
    "1",
    NaN,
    null,
    undefined,
    {},
  ])
    expect(isBalloonSkinId(invalid)).toBe(false);
  const s = createPractice();
  placeBalloon(s, s.players[0]);
  expect(s.balloons[0].skinId).toBe(0);
});
