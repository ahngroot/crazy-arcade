/** Development-only visual fixtures. Not imported by the production entry point. */
import Phaser from "phaser";
import {
  createCompetition,
  createArenaPractice,
  type PracticeState,
  type Facing,
} from "@bubble/shared";
import { installArt, keyPlayer, safeTexture, type Pose } from "./art";
import { GameRenderer } from "./renderer";

/** Reference map QA, uses the same catalogue and renderer as both product modes. */
export function mountArenaFixture(parent: HTMLElement, id: string) {
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => (resolveReady = resolve));
  const state = createArenaPractice(38459, undefined, id);
  state.players[0].characterId = 0;
  class ArenaScene extends Phaser.Scene {
    private view!: GameRenderer;
    constructor() {
      super("arena-fixture");
    }
    create() {
      this.view = new GameRenderer(this, parent, false);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.view.destroy(),
      );
      this.game.events.once(Phaser.Core.Events.POST_RENDER, resolveReady);
    }
    update(_time: number, delta: number) {
      this.view.update(state, delta);
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 600,
    height: 520,
    scene: new ArenaScene(),
    audio: { noAudio: true },
    fps: { smoothStep: false },
  });
  return { ready, state, destroy: () => game.destroy(true) };
}

export function mountArtGallery(parent: HTMLElement) {
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => (resolveReady = resolve));
  const sprites: {
    image: Phaser.GameObjects.Image;
    team: "red" | "green";
    pose: Pose;
    dir: Facing;
  }[] = [];
  class Gallery extends Phaser.Scene {
    constructor() {
      super("art-gallery");
    }
    create() {
      installArt(this);
      this.cameras.main.setBackgroundColor("#f4f5e9");
      this.add.text(30, 22, "CLOVER GARDEN · ORIGINAL ART COLLECTION", {
        fontFamily: "Arial",
        fontSize: "19px",
        fontStyle: "bold",
        color: "#345c59",
      });
      this.add.text(
        30,
        53,
        "4-direction walking • idle • expressions • original critters and item icons",
        { fontFamily: "Arial", fontSize: "12px", color: "#83937e" },
      );
      for (const [row, team] of (["red", "green"] as const).entries())
        for (const [column, dir] of (
          ["down", "up", "left", "right"] as const
        ).entries()) {
          const x = 95 + column * 145,
            y = 160 + row * 150;
          this.add.image(x, y + 49, "art-shadow").setDisplaySize(62, 18);
          const image = this.add
            .image(x, y, keyPlayer(team, "walk", dir, 0))
            .setDisplaySize(76, 95);
          sprites.push({ image, team, pose: "walk", dir });
          this.add
            .text(x, y + 62, `${team.toUpperCase()} · ${dir}`, {
              fontFamily: "Arial",
              fontSize: "11px",
              color: "#658176",
            })
            .setOrigin(0.5);
        }
      for (const [index, pose] of (
        ["idle", "trapped", "defeat", "win", "lose"] as const
      ).entries()) {
        const x = 75 + index * 125,
          y = 456;
        const image = this.add
          .image(x, y, keyPlayer(index % 2 ? "green" : "red", pose, "down", 0))
          .setDisplaySize(70, 87.5);
        sprites.push({
          image,
          team: index % 2 ? "green" : "red",
          pose,
          dir: "down",
        });
        this.add
          .text(x, y + 59, pose.toUpperCase(), {
            fontFamily: "Arial",
            fontSize: "10px",
            color: "#658176",
          })
          .setOrigin(0.5);
      }
      for (const [index, kind] of (
        ["normal", "chaser", "golden"] as const
      ).entries()) {
        const x = 728,
          y = 155 + index * 155;
        this.add
          .image(x, y, `art-monster-${kind}-0`)
          .setDisplaySize(88, 88)
          .setName(kind);
        this.add
          .text(x, y + 57, kind.toUpperCase(), {
            fontFamily: "Arial",
            fontSize: "11px",
            color: "#658176",
          })
          .setOrigin(0.5);
      }
      for (const [index, kind] of (
        [
          "balloon",
          "range",
          "speed",
          "needle",
          "shield",
          "power",
          "ultra",
          "glove",
          "shoes",
          "ghost",
        ] as const
      ).entries()) {
        const x = 45 + index * 80,
          y = 635;
        this.add.image(x, y, `art-item-${kind}`).setDisplaySize(49, 52);
        this.add
          .text(x, y + 38, kind.toUpperCase(), {
            fontFamily: "Arial",
            fontSize: "10px",
            color: "#658176",
          })
          .setOrigin(0.5);
      }
      this.game.events.once(Phaser.Core.Events.POST_RENDER, resolveReady);
    }
    update(time: number) {
      const frame = Math.floor(time / 150) % 4;
      for (const sprite of sprites)
        sprite.image.setTexture(
          safeTexture(
            this,
            keyPlayer(sprite.team, sprite.pose, sprite.dir, frame),
          ),
        );
      for (const kind of ["normal", "chaser", "golden"]) {
        const sprite = this.children.getByName(
          kind,
        ) as Phaser.GameObjects.Image;
        sprite.setTexture(safeTexture(this, `art-monster-${kind}-${frame}`));
      }
    }
  }
  const scene = new Gallery();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 840,
    height: 720,
    scene,
    backgroundColor: "#f4f5e9",
    audio: { noAudio: true },
    fps: { smoothStep: false },
  });
  return {
    ready,
    textureCount: () => scene.textures.getTextureKeys().length,
    removeWalkingFrames: () => {
      for (let f = 0; f < 4; f++)
        scene.textures.remove(keyPlayer("red", "walk", "down", f));
    },
    fallbackVisible: () => sprites[0].image.texture.key === "art-fallback",
    destroy: () => game.destroy(true),
  };
}

export function mountRendererFixture(parent: HTMLElement) {
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => (resolveReady = resolve));
  const state: PracticeState = createCompetition();
  state.round!.monsters = [];
  const clear = (x: number, y: number) => {
    state.map[y][x] = "floor";
    state.mapRevision++;
  };
  state.players[0].position = { x: 3.5, y: 7.5 };
  state.players[1].position = { x: 11.5, y: 7.5 };
  for (const [i, kind] of (["normal", "chaser", "golden"] as const).entries()) {
    const pos = { x: 3.5 + i * 3, y: 3.5 };
    clear(Math.floor(pos.x), Math.floor(pos.y));
    state.round!.monsters.push({
      id: 100 + i,
      team: i === 2 ? "green" : "red",
      kind,
      position: pos,
      home: { ...pos },
      target: null,
      bornAt: 0,
    });
  }
  for (const [i, kind] of (
    ["balloon", "range", "speed", "needle", "shield", "power"] as const
  ).entries()) {
    const x = i < 3 ? 1 + i * 2 : 8 + (i - 3) * 2;
    clear(x, 9);
    state.items.push({ id: 200 + i, kind, x, y: 9, availableAt: 0 });
  }
  class Fixture extends Phaser.Scene {
    private view!: GameRenderer;
    private frozen = false;
    constructor() {
      super("renderer-fixture");
    }
    create() {
      this.view = new GameRenderer(this, parent, false);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.view.destroy(),
      );
      this.game.events.once(Phaser.Core.Events.POST_RENDER, resolveReady);
    }
    update(_time: number, delta: number) {
      this.view.update(state, this.frozen ? 0 : delta);
    }
    capture() {
      this.frozen = true;
      this.view.update(state, 80);
      this.view.update(state, 80);
    }
  }
  const scene = new Fixture();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 600,
    height: 520,
    scene,
    audio: { noAudio: true },
    fps: { smoothStep: false },
  });
  return {
    ready,
    state,
    capture: () => scene.capture(),
    trapped() {
      state.time += 100;
      state.tick++;
      state.players[0].status = "trapped";
      state.players[1].status = "respawning";
      state.blasts = [
        {
          id: 400,
          owner: "p1",
          expiresAt: 1000,
          cells: [
            { x: 3, y: 7 },
            { x: 2, y: 7 },
            { x: 4, y: 7 },
            { x: 3, y: 6 },
            { x: 3, y: 8 },
          ],
        },
      ];
    },
    golden() {
      state.time += 100;
      state.tick++;
      state.blasts = [];
      state.players.forEach((p) => (p.status = "active"));
      state.players[0].combo = 8;
      state.players[0].score = 15;
      state.round!.events.push({
        id: 500,
        kind: "golden",
        position: { x: 9.5, y: 3.5 },
        until: 1500,
      });
    },
    finish() {
      state.time += 100;
      state.tick++;
      state.blasts = [];
      state.round!.phase = "FINISHED";
      state.round!.winner = "red";
    },
    crowd() {
      state.time += 100;
      state.tick++;
      for (let i = 0; i < 80; i++)
        state.round!.events.push({
          id: 1000 + i,
          kind: "kill",
          position: { x: 1.5 + (i % 12), y: 2.5 + (i % 7) },
          until: 1500,
        });
    },
    destroy: () => game.destroy(true),
  };
}
