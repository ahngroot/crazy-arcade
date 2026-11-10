import { expect, it } from "vitest";
import {
  BALLOON_SKIN_COUNT,
  placeBalloon,
  GAME_CONFIG as C,
} from "@bubble/shared";
import { RoomService } from "./rooms";

it("shares each seat's balloon choice in the lobby, game, placed balloons and reconnect", () => {
  for (let id = 0; id < BALLOON_SKIN_COUNT; id++) {
    let now = 1000;
    const s = new RoomService(() => now);
    const a = s.create("a", "ip", {
      nickname: "A",
      durationMs: 30000,
      balloonSkinId: id,
    });
    if (!a.ok) throw Error(a.error);
    const b = s.join("b", "ip", {
      nickname: "B",
      code: a.room.code,
      balloonSkinId: BALLOON_SKIN_COUNT - 1 - id,
    });
    if (!b.ok) throw Error(b.error);
    expect(b.room.players.map((p) => p.balloonSkinId)).toEqual([
      id,
      BALLOON_SKIN_COUNT - 1 - id,
    ]);
    s.ready("a", true);
    s.ready("b", true);
    const game = s.current("a")!.game!;
    expect(game.players.map((p) => p.balloonSkinId)).toEqual([
      id,
      BALLOON_SKIN_COUNT - 1 - id,
    ]);
    for (const p of game.players) expect(placeBalloon(game, p)).toBe(true);
    expect(game.balloons.map((b) => b.skinId)).toEqual([
      id,
      BALLOON_SKIN_COUNT - 1 - id,
    ]);
    now += 3000;
    s.advance();
    s.disconnect("a");
    const resumed = s.resume("new-a", "ip", { token: a.token });
    if (!resumed.ok) throw Error(resumed.error);
    expect(resumed.room.players[0].balloonSkinId).toBe(id);
    expect(resumed.room.game!.balloons[0].skinId).toBe(id);
    for (let frame = 0; frame < 125; frame++) {
      now += C.maxFrameMs;
      s.advance();
    }
    expect(s.current("new-a")!.phase).toBe("FINISHED");
    s.ready("new-a", true);
    s.ready("b", true);
    expect(
      s.current("new-a")!.game!.players.map((p) => p.balloonSkinId),
    ).toEqual([id, BALLOON_SKIN_COUNT - 1 - id]);
  }
});
it("rejects malformed skin choices before room creation or admission", () => {
  for (const id of [-1, BALLOON_SKIN_COUNT, 1.5, "2", null, {}, NaN]) {
    const s = new RoomService();
    expect(
      s.create("bad", "ip", {
        nickname: "A",
        durationMs: 30000,
        balloonSkinId: id,
      }).ok,
    ).toBe(false);
    const a = s.create("a", "ip", { nickname: "A", durationMs: 30000 });
    if (!a.ok) throw Error(a.error);
    expect(
      s.join("bad", "ip", {
        nickname: "B",
        code: a.room.code,
        balloonSkinId: id,
      }).ok,
    ).toBe(false);
    expect(s.current("a")!.players).toHaveLength(1);
  }
});
