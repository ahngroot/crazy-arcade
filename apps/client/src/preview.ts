import Phaser from "phaser";
import {
  createCompetition,
  GAME_CONFIG as C,
  type Monster,
} from "@bubble/shared";
import { GameRenderer } from "./renderer";

export function mountPreview(parent: HTMLElement) {
  class PreviewScene extends Phaser.Scene {
    private view!: GameRenderer;
    private state = createCompetition();
    constructor() {
      super("preview");
    }
    create() {
      const seeds: Pick<Monster, "id" | "kind" | "team" | "position">[] = [
        { id: 101, kind: "normal", team: "red", position: { x: 1.5, y: 3.5 } },
        {
          id: 102,
          kind: "normal",
          team: "green",
          position: { x: 13.5, y: 3.5 },
        },
        { id: 103, kind: "golden", team: "red", position: { x: 3.5, y: 5.5 } },
        {
          id: 104,
          kind: "chaser",
          team: "green",
          position: { x: 11.5, y: 5.5 },
        },
      ];
      this.state.round!.monsters = seeds.map((m) => ({
        ...m,
        home: { ...m.position },
        target: null,
        bornAt: 0,
      }));
      this.state.balloons = [
        {
          id: 201,
          owner: "p1",
          x: 3,
          y: 7,
          range: 1,
          explodesAt: Infinity,
          passThrough: [],
        },
        {
          id: 202,
          owner: "p2",
          x: 11,
          y: 7,
          range: 1,
          explodesAt: Infinity,
          passThrough: [],
        },
      ];
      this.view = new GameRenderer(this, parent, false);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.view.destroy(),
      );
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
        parent.setAttribute("data-ready", "true"),
      );
    }
    update(_time: number, delta: number) {
      this.view.update(this.state, delta);
    }
  }
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: C.columns * C.tileSize,
    height: C.rows * C.tileSize,
    scene: PreviewScene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    backgroundColor: "#caf0d7",
    audio: { noAudio: true },
    render: { antialias: true },
    fps: { smoothStep: false },
  });
}
