import { expect, it } from "vitest";
import {
  createArenaPractice,
  stepPractice,
  defeatPlayer,
  EMPTY_INPUT,
  GAME_CONFIG as C,
} from "./index";
it("removes expired floor items before they can be collected at the expiry tick", () => {
  const s = createArenaPractice(45),
    p = s.players[0];
  s.items.push({
    id: 200,
    kind: "needle",
    x: Math.floor(p.position.x),
    y: Math.floor(p.position.y),
    availableAt: 13000,
    expiresAt: 12000,
  });
  stepPractice(s, [EMPTY_INPUT], 11990);
  expect(s.items).toHaveLength(1);
  stepPractice(s, [EMPTY_INPUT], 30);
  expect(s.items).toHaveLength(0);
  expect(p.inventory).toEqual([]);
});
it("starts the twelve-second lifetime separately at each death item's landing time", () => {
  const s = createArenaPractice(45),
    p = s.players[0];
  p.inventory = ["shield", "needle"];
  defeatPlayer(s, p);
  expect(s.items.map((i) => i.expiresAt! - i.flight!.landsAt)).toEqual([
    12000, 12000,
  ]);
  p.status = "trapped";
  p.statusUntil = Infinity;
  const first = s.items[0].expiresAt!,
    second = s.items[1].expiresAt!;
  stepPractice(s, [EMPTY_INPUT], first + C.fixedStepMs / 2);
  expect(s.items.map((i) => i.kind)).toEqual(["needle"]);
  stepPractice(s, [EMPTY_INPUT], second - s.time + C.fixedStepMs);
  expect(s.items).toHaveLength(0);
});
