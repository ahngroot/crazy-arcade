import { it, expect } from "vitest";
import {
  createPractice,
  createCompetition,
  placeBalloon,
  stepPractice,
  EMPTY_INPUT,
  GAME_CONFIG as C,
} from "@bubble/shared";
import { PresentationTracker } from "./presentation";
const idle = [EMPTY_INPUT, EMPTY_INPUT];
it("baselines a mounted/reconnected state without replaying old effects or mutating it", () => {
  const s = createCompetition();
  placeBalloon(s, s.players[0]);
  stepPractice(s, idle, C.balloonFuseMs);
  const before = JSON.stringify(s),
    tracker = new PresentationTracker();
  expect(tracker.observe(s)).toEqual([]);
  expect(JSON.stringify(s)).toBe(before);
});
it("detects each placement and chain explosion once, including mutable local state", () => {
  const s = createPractice(),
    tracker = new PresentationTracker();
  tracker.observe(s);
  placeBalloon(s, s.players[0]);
  expect(tracker.observe(s).map((e) => e.kind)).toEqual(["place"]);
  expect(tracker.observe(s)).toEqual([]);
  stepPractice(s, idle, C.balloonFuseMs);
  const kinds = tracker.observe(s).map((e) => e.kind);
  expect(kinds).toContain("explode");
  expect(kinds).toContain("trap");
  expect(tracker.observe(s)).toEqual([]);
});
it("distinguishes crate debris from a collected upgrade", () => {
  const s = createPractice(),
    tracker = new PresentationTracker();
  tracker.observe(s);
  s.map[1][2] = "floor";
  expect(tracker.observe(s)).toContainEqual({
    kind: "pickup",
    position: { x: 2.5, y: 1.5 },
    value: 0,
  });
  s.players[0].capacity++;
  expect(tracker.observe(s).find((e) => e.kind === "pickup")?.value).toBe(1);
});
it("observes combo, golden appearance, kill score and round result only once", () => {
  const s = createCompetition(),
    tracker = new PresentationTracker();
  tracker.observe(s);
  s.round!.events.push({
    id: 800,
    kind: "golden",
    position: { x: 3.5, y: 5.5 },
    until: 1000,
  });
  s.players[0].score = 3;
  s.players[0].combo = 2;
  expect(tracker.observe(s).map((e) => e.kind)).toEqual([
    "golden",
    "combo",
    "kill",
  ]);
  expect(tracker.observe(s)).toEqual([]);
  s.round!.phase = "FINISHED";
  expect(tracker.observe(s).map((e) => e.kind)).toEqual(["finish"]);
  expect(tracker.observe(s)).toEqual([]);
});
it("observes defeat and respawn separately and suppresses effect history on restart", () => {
  const s = createPractice(),
    tracker = new PresentationTracker();
  tracker.observe(s);
  placeBalloon(s, s.players[0]);
  stepPractice(s, idle, C.balloonFuseMs);
  tracker.observe(s);
  stepPractice(s, idle, C.trappedMs);
  expect(tracker.observe(s).map((e) => e.kind)).toContain("defeat");
  stepPractice(s, idle, C.respawnMs);
  expect(tracker.observe(s).map((e) => e.kind)).toContain("respawn");
  expect(tracker.observe(createPractice())).toEqual([]);
});
it("does not duplicate an online effect when the same snapshot arrives again", () => {
  const s = createCompetition(),
    tracker = new PresentationTracker();
  tracker.observe(s);
  s.round!.events.push({
    id: 99,
    kind: "kill",
    position: { x: 3, y: 4 },
    until: 500,
  });
  expect(tracker.observe(structuredClone(s)).map((e) => e.kind)).toEqual([
    "kill",
  ]);
  expect(tracker.observe(structuredClone(s))).toEqual([]);
});
it("announces distinct 30- and 15-second warnings without repeating the cue", () => {
  const s = createCompetition(),
    tracker = new PresentationTracker();
  tracker.observe(s);
  s.round!.warning = "rush";
  expect(tracker.observe(s).map((e) => e.kind)).toEqual(["warning"]);
  expect(tracker.observe(s)).toEqual([]);
  s.round!.warning = "final";
  expect(tracker.observe(s).map((e) => e.kind)).toEqual(["warning"]);
});
it("keeps an upgrade cue when an inventory item is consumed in the same frame", () => {
  const s = createPractice(),
    tracker = new PresentationTracker();
  s.players[0].inventory.power = 1;
  tracker.observe(s);
  s.players[0].capacity++;
  s.players[0].inventory.power--;
  expect(tracker.observe(s).some((e) => e.kind === "pickup")).toBe(true);
});
