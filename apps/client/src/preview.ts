import Phaser from "phaser";
import { createCompetition, GAME_CONFIG as C, arenaById } from "@bubble/shared";
import { GameRenderer } from "./renderer";

export function mountPreview(parent: HTMLElement) {
  class PreviewScene extends Phaser.Scene {
    private view!: GameRenderer;
    private state = createCompetition(2701, C.roundMs, { id: "pirate-lion" });
    private elapsed = 0;
    constructor() {
      super("preview");
    }
    create() {
      this.state.players.forEach((p, i) => (p.characterId = i ? 7 : 0));
      this.view = new GameRenderer(this, parent, false);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.view.destroy(),
      );
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
        parent.setAttribute("data-ready", "true"),
      );
    }
    update(_time: number, delta: number) {
      this.elapsed += delta;
      if (this.elapsed > 8000) {
        this.state = createCompetition(
          crypto.getRandomValues(new Uint32Array(1))[0],
          C.roundMs,
          { previousId: this.state.arenaId },
        );
        this.state.players.forEach((p, i) => (p.characterId = i ? 7 : 0));
        this.view.reset();
        this.elapsed = 0;
      }
      this.view.update(this.state, delta);
      const label = document.querySelector("#preview-map-name");
      if (label) label.textContent = arenaById(this.state.arenaId)!.name;
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
