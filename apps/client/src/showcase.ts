/** Development-only visual fixtures. Not imported by the production entry point. */
import Phaser from "phaser";
import {
  createCompetition,
  createArenaPractice,
  defeatPlayer,
  type PracticeState,
  type Facing,
} from "@bubble/shared";
import { installArt, keyPlayer, safeTexture, type Pose } from "./art";
import { GameRenderer } from "./renderer";

/** Reference map QA, uses the same catalogue and renderer as both product modes. */
export function mountArenaFixture(
  parent: HTMLElement,
  id: string,
  palette: "original" | "pastel" = "pastel",
  frozen = false,
) {
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
      this.view = new GameRenderer(this, parent, false, "p1", palette);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.view.destroy(),
      );
      this.game.events.once(Phaser.Core.Events.POST_RENDER, resolveReady);
    }
    update(_time: number, delta: number) {
      this.view.update(state, frozen ? 0 : delta);
    }
  }
  const scene = new ArenaScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 600,
    height: 520,
    scene: scene,
    audio: { noAudio: true },
    fps: { smoothStep: false },
  });
  return {
    ready,
    state,
    textureFingerprint(key: string) {
      const canvas = scene.textures
        .get(key)
        .getSourceImage() as HTMLCanvasElement;
      const pixels = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
      return hash >>> 0;
    },
    scatter() {
      state.players[0].inventory = ["shield", "needle"];
      state.players[0].capacity = 3;
      defeatPlayer(state, state.players[0]);
    },
    itemFrames() {
      return scene.children.list
        .filter(
          (o) =>
            o instanceof Phaser.GameObjects.Image &&
            o.texture.key.startsWith("art-item-"),
        )
        .map((o) => {
          const image = o as Phaser.GameObjects.Image;
          return {
            id: image.getData("itemId") as number,
            x: image.x,
            y: image.y,
            width: image.displayWidth,
            height: image.displayHeight,
            alpha: image.alpha,
          };
        })
        .sort((a, b) => a.id - b.id);
    },
    destroy: () => game.destroy(true),
  };
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

export function mountRendererFixture(parent: HTMLElement, playerId = "p1") {
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
      this.view = new GameRenderer(this, parent, false, playerId);
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
    actorFrames() {
      return scene.children.list
        .filter(
          (obj): obj is Phaser.GameObjects.Image =>
            obj instanceof Phaser.GameObjects.Image &&
            /art-(character|direction|trapped|trap-help|prone)/.test(
              obj.texture.key,
            ),
        )
        .map((image) => ({
          key: image.texture.key,
          x: image.x,
          y: image.y,
          alpha: image.alpha,
          visible: image.visible,
          angle: image.angle,
        }));
    },
    characterVisibleBounds() {
      return scene.children.list
        .filter(
          (o): o is Phaser.GameObjects.Image =>
            o instanceof Phaser.GameObjects.Image &&
            /^art-(character|direction)-/.test(o.texture.key) &&
            o.visible,
        )
        .map((o) => {
          const source = o.texture.getSourceImage() as HTMLCanvasElement;
          const pixels = source
            .getContext("2d")!
            .getImageData(0, 0, source.width, source.height).data;
          let l = source.width,
            r = 0,
            t = source.height,
            b = 0;
          for (let y = 0; y < source.height; y++)
            for (let x = 0; x < source.width; x++)
              if (pixels[(y * source.width + x) * 4 + 3] > 32) {
                l = Math.min(l, x);
                r = Math.max(r, x + 1);
                t = Math.min(t, y);
                b = Math.max(b, y + 1);
              }
          return {
            left: o.x + (l / source.width - o.originX) * o.displayWidth,
            right: o.x + (r / source.width - o.originX) * o.displayWidth,
            top: o.y + (t / source.height - o.originY) * o.displayHeight,
            bottom: o.y + (b / source.height - o.originY) * o.displayHeight,
          };
        });
    },
    arrowFrames() {
      return scene.children.list
        .filter(
          (o): o is Phaser.GameObjects.Image =>
            o instanceof Phaser.GameObjects.Image &&
            o.texture.key === "art-self-arrow",
        )
        .map((o) => ({
          x: o.x,
          y: o.y,
          visible: o.visible,
          width: o.displayWidth,
          height: o.displayHeight,
        }));
    },
    characterTextureUrl(key: string) {
      return (
        scene.textures.get(key).getSourceImage() as HTMLCanvasElement
      ).toDataURL();
    },
    characterTextureInfo() {
      return scene.textures
        .getTextureKeys()
        .filter((key) => /^art-(direction|character)-/.test(key))
        .map((key) => {
          const source = scene.textures
            .get(key)
            .getSourceImage() as HTMLCanvasElement;
          const ctx = source.getContext("2d")!;
          const pixels = ctx.getImageData(
            0,
            0,
            source.width,
            source.height,
          ).data;
          let visible = 0,
            footHash = 2166136261,
            top = source.height,
            bottom = 0,
            edgePixels = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] > 80) {
              visible++;
              const x = (i / 4) % source.width;
              const y = Math.floor(i / 4 / source.width);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
              if (
                x === 0 ||
                x === source.width - 1 ||
                y === 0 ||
                y === source.height - 1
              )
                edgePixels++;
            }
            if (i >= source.width * 58 * 4)
              for (let k = 0; k < 4; k++)
                footHash = Math.imul(footHash ^ pixels[i + k], 16777619);
          }
          return {
            key,
            visible,
            footHash,
            height: bottom - top + 1,
            bottom,
            edgePixels,
          };
        });
    },
    waterFrames() {
      return scene.children.list
        .filter(
          (obj): obj is Phaser.GameObjects.Image =>
            obj instanceof Phaser.GameObjects.Image &&
            obj.texture.key.startsWith("art-stream-"),
        )
        .map((image) => ({ key: image.texture.key, angle: image.angle }));
    },
    balloonFrame() {
      const images = scene.children.list.filter(
        (obj): obj is Phaser.GameObjects.Image =>
          obj instanceof Phaser.GameObjects.Image,
      );
      const balloon = images.find((image) =>
        /^art-balloon(?:-flow-\d+)?$/.test(image.texture.key),
      )!;
      const shadow = images.find(
        (image) =>
          image.texture.key === "art-shadow" &&
          image.x === balloon.x &&
          image.depth === 1,
      )!;
      return {
        x: balloon.x,
        y: balloon.y,
        key: balloon.texture.key,
        shadowY: shadow.y,
        shadowWidth: shadow.displayWidth,
      };
    },
    balloonTextureUrl(key: string) {
      return (
        scene.textures.get(key).getSourceImage() as HTMLCanvasElement
      ).toDataURL();
    },
    itemTextureExtents() {
      return [
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
      ].map((kind) => {
        const canvas = scene.textures
          .get(`art-item-${kind}`)
          .getSourceImage() as HTMLCanvasElement;
        const pixels = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width,
          top = canvas.height,
          right = 0,
          bottom = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++)
            if (pixels[(y * canvas.width + x) * 4 + 3] > 32) {
              left = Math.min(left, x);
              top = Math.min(top, y);
              right = Math.max(right, x);
              bottom = Math.max(bottom, y);
            }
        return { kind, extent: Math.max(right - left + 1, bottom - top + 1) };
      });
    },
    balloonFrames() {
      return scene.children.list
        .filter(
          (o): o is Phaser.GameObjects.Image =>
            o instanceof Phaser.GameObjects.Image &&
            (o.texture.key === "art-balloon" ||
              o.texture.key.startsWith("art-balloon-flow-") ||
              o.texture.key.startsWith("art-balloon-skin-")),
        )
        .map((o) => ({
          key: o.texture.key,
          x: o.x,
          y: o.y,
          angle: o.angle,
          originY: o.originY,
          width: o.displayWidth,
          height: o.displayHeight,
        }));
    },
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
