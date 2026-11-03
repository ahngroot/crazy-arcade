import Phaser from "phaser";
import { createPreviewMap, GAME_CONFIG } from "@bubble/shared";

class PreviewScene extends Phaser.Scene {
  constructor() {
    super("preview");
  }
  create() {
    const g = this.add.graphics();
    const map = createPreviewMap(),
      size = GAME_CONFIG.tileSize;
    for (let y = 0; y < map.length; y++)
      for (let x = 0; x < map[y].length; x++) {
        const px = x * size,
          py = y * size;
        g.fillStyle(x < 7 ? 0xeedfc7 : 0xcde1cd);
        g.fillRect(px, py, size, size);
        g.lineStyle(1, x < 7 ? 0xe3d1b5 : 0xb9d1bc);
        g.strokeRect(px, py, size, size);
        if (map[y][x] === "wall") {
          g.fillStyle(0x426955);
          g.fillRoundedRect(px + 2, py + 5, 36, 34, 7);
          g.fillStyle(0x6c9972);
          g.fillRoundedRect(px + 2, py + 1, 36, 30, 7);
          g.fillStyle(0x8ab187);
          g.fillRoundedRect(px + 5, py + 3, 30, 8, 4);
          g.fillStyle(0xadd09a, 0.5);
          g.fillCircle(px + 11, py + 16, 3);
        } else if (map[y][x] === "crate") {
          g.fillStyle(0x93613f);
          g.fillRoundedRect(px + 4, py + 6, 32, 33, 4);
          g.fillStyle(0xd39b5b);
          g.fillRoundedRect(px + 4, py + 2, 32, 30, 4);
          g.lineStyle(3, 0xf3c881);
          g.strokeRect(px + 8, py + 6, 24, 21);
          g.lineBetween(px + 9, py + 7, px + 30, py + 26);
        } else if ((x + y) % 5 === 0) {
          g.fillStyle(0xffffff, 0.3);
          g.fillCircle(px + 12, py + 13, 2);
          g.fillCircle(px + 26, py + 29, 2);
        }
      }
    this.critter(60, 60, 0xf47a68, true, 0);
    this.critter(540, 60, 0x65be9b, true, 500);
    this.critter(140, 180, 0xecc457, false, 150);
    this.critter(460, 180, 0xb191d2, false, 650);
    this.critter(220, 340, 0xecc457, false, 350);
    this.critter(380, 340, 0xecc457, false, 850);
    for (const [x, y] of [
      [140, 220],
      [460, 220],
    ]) {
      const bubble = this.add.graphics({ x, y });
      bubble.fillStyle(0x305c62, 0.18);
      bubble.fillEllipse(0, 14, 30, 10);
      bubble.lineStyle(2, 0x2d91b4);
      bubble.fillStyle(0x70d4ed, 0.9);
      bubble.fillCircle(0, 0, 15);
      bubble.strokeCircle(0, 0, 15);
      bubble.fillStyle(0xc8f6ff);
      bubble.fillEllipse(-5, -6, 8, 5);
      bubble.fillStyle(0xffffff);
      bubble.fillCircle(-6, -7, 2);
      this.tweens.add({
        targets: bubble,
        scaleY: 1.08,
        scaleX: 0.96,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    }
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      document.querySelector("#arena")?.setAttribute("data-ready", "true");
    });
  }
  private critter(
    x: number,
    y: number,
    color: number,
    player: boolean,
    delay: number,
  ) {
    const shadow = this.add.graphics({ x, y });
    shadow.fillStyle(0x23483c, 0.18);
    shadow.fillEllipse(0, 15, 31, 10);
    const body = this.add.graphics({ x, y });
    body.lineStyle(2, 0x344a42);
    body.fillStyle(color);
    body.fillRoundedRect(-16, -15, 32, 30, 13);
    body.strokeRoundedRect(-16, -15, 32, 30, 13);
    body.fillStyle(color);
    body.fillEllipse(-8, 15, 11, 7);
    body.fillEllipse(8, 15, 11, 7);
    if (player) {
      body.fillStyle(color);
      body.fillEllipse(-10, -20, 8, 15);
      body.fillEllipse(10, -20, 8, 15);
      body.fillStyle(0xffe6cb);
      body.fillRoundedRect(-12, -7, 24, 18, 8);
    } else {
      body.lineStyle(2, 0x344a42);
      body.lineBetween(0, -15, 4, -23);
      body.fillStyle(0x79a967);
      body.fillEllipse(7, -22, 10, 5);
    }
    body.fillStyle(0x263d36);
    body.fillEllipse(-5, 0, 3, 5);
    body.fillEllipse(5, 0, 3, 5);
    body.lineStyle(1.5, 0x263d36);
    body.lineBetween(-2, 6, 2, 6);
    body.fillStyle(0xef9688, 0.8);
    body.fillEllipse(-10, 5, 5, 3);
    body.fillEllipse(10, 5, 5, 3);
    body.fillStyle(0xffffff, 0.5);
    body.fillEllipse(-7, -11, 8, 3);
    this.tweens.add({
      targets: body,
      y: y - 3,
      duration: 900,
      delay,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}

export function mountPreview(parent: HTMLElement) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_CONFIG.columns * GAME_CONFIG.tileSize,
    height: GAME_CONFIG.rows * GAME_CONFIG.tileSize,
    backgroundColor: "#cde1cd",
    scene: PreviewScene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    audio: { noAudio: true },
  });
}
