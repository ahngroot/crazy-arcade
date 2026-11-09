import Phaser from "phaser";
import {
  GAME_CONFIG as C,
  type PracticeState,
  type PracticePlayer,
  type Position,
} from "@bubble/shared";
import {
  ART,
  installArt,
  keyPlayer,
  keyCharacter,
  safeTexture,
  type Pose,
} from "./art";
import { PresentationTracker, type PresentationEvent } from "./presentation";
import { arcadeAudio } from "./audio";

type Actor = {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  status: string;
  changedAt: number;
};
type Particle = {
  image: Phaser.GameObjects.Image;
  life: number;
  elapsed: number;
  vx: number;
  vy: number;
  spin: number;
  scale: number;
};
type Ring = {
  position: Position;
  elapsed: number;
  life: number;
  color: number;
};
type Popup = { text: Phaser.GameObjects.Text; elapsed: number };

/** Owns display objects only. No mutation or simulation of the supplied game state. */
export class GameRenderer {
  private tracker = new PresentationTracker();
  private players = new Map<string, Actor>();
  private monsters = new Map<number, Actor>();
  private balloons = new Map<number, Actor>();
  private items = new Map<number, Actor>();
  private blocks = new Map<
    string,
    { kind: string; image: Phaser.GameObjects.Image }
  >();
  private floors: Phaser.GameObjects.Image[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private water: Phaser.GameObjects.Graphics;
  private overlays: Phaser.GameObjects.Graphics;
  private revision = -1;
  private clock = 0;
  private lastTime = -1;
  private lastPhase = "";
  private terrain = "";
  constructor(
    private scene: Phaser.Scene,
    private parent: HTMLElement,
    private sound = true,
    private playerId = "p1",
  ) {
    installArt(scene);
    for (let y = 0; y < C.rows; y++)
      for (let x = 0; x < C.columns; x++) {
        this.floors.push(
          scene.add
            .image(
              (x + 0.5) * C.tileSize,
              (y + 0.5) * C.tileSize,
              `art-ground-${x < 7 ? "red" : "green"}-${(x + y) % 2}`,
            )
            .setDisplaySize(C.tileSize, C.tileSize)
            .setDepth(0),
        );
      }
    this.water = scene.add.graphics().setDepth(2);
    this.overlays = scene.add.graphics().setDepth(20000);
    parent.dataset.art = "original-vector-v1";
  }
  private image(key: string, w: number, h: number) {
    return this.scene.add
      .image(0, 0, safeTexture(this.scene, key))
      .setDisplaySize(w, h);
  }
  private actor<K extends string | number>(
    map: Map<K, Actor>,
    id: K,
    key: string,
    w: number,
    h: number,
    origin = 0.9,
  ) {
    let actor = map.get(id);
    if (!actor) {
      actor = {
        image: this.image(key, w, h).setOrigin(0.5, origin),
        shadow: this.image("art-shadow", 29, 11),
        status: "",
        changedAt: this.clock,
      };
      map.set(id, actor);
    }
    actor.image.setTexture(safeTexture(this.scene, key));
    return actor;
  }
  private prune<K extends string | number>(map: Map<K, Actor>, ids: Set<K>) {
    for (const [id, actor] of map)
      if (!ids.has(id)) {
        actor.image.destroy();
        actor.shadow.destroy();
        map.delete(id);
      }
  }
  private blocksFrom(state: PracticeState) {
    const terrain = state.terrain ?? "garden";
    if (terrain !== this.terrain) {
      this.terrain = terrain;
      this.parent.dataset.mapTheme = terrain;
      this.floors.forEach((floor, i) => {
        const x = i % C.columns,
          y = Math.floor(i / C.columns);
        floor.setTexture(
          terrain === "battle"
            ? `art-ground-battle-${(x + y) % 2}`
            : `art-ground-${x < 7 ? "red" : "green"}-${(x + y) % 2}`,
        );
      });
      for (const block of this.blocks.values()) block.image.destroy();
      this.blocks.clear();
      this.revision = -1;
    }
    if (state.mapRevision === this.revision) return;
    this.revision = state.mapRevision;
    state.map.forEach((row, y) =>
      row.forEach((tile, x) => {
        const id = `${x},${y}`,
          old = this.blocks.get(id);
        if (old?.kind === tile) return;
        if (old) {
          old.image.destroy();
          this.blocks.delete(id);
        }
        if (tile !== "floor")
          this.blocks.set(id, {
            kind: tile,
            image: this.scene.add
              .image(
                (x + 0.5) * C.tileSize,
                (y + 1) * C.tileSize,
                safeTexture(
                  this.scene,
                  terrain === "battle"
                    ? tile === "wall"
                      ? "art-wall-battle"
                      : `art-crate-battle-${(x + y) % 3}`
                    : `art-${tile}`,
                ),
              )
              .setOrigin(0.5, 1)
              .setDisplaySize(40, 48)
              .setDepth((y + 1) * C.tileSize - 3),
          });
      }),
    );
  }
  private burst(
    position: Position,
    key: string,
    count: number,
    color?: number,
  ) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= ART.particleLimit)
        this.particles.shift()!.image.destroy();
      const angle = (i / count) * Math.PI * 2 + (this.clock % 37) / 37,
        speed = 28 + ((i * 23) % 65),
        scale = key === "art-drop" ? 6 + (i % 3) * 2 : 7 + (i % 3) * 2;
      const image = this.image(
        key,
        scale,
        scale * (key === "art-drop" ? 1.3 : 1),
      )
        .setPosition(position.x * C.tileSize, position.y * C.tileSize - 8)
        .setDepth(21000);
      if (color !== undefined) image.setTint(color);
      this.particles.push({
        image,
        life: 450 + (i % 4) * 100,
        elapsed: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        spin: (i % 2 ? 1 : -1) * 2,
        scale,
      });
    }
  }
  private ring(position: Position, color: number, life = 650) {
    this.rings.push({ position: { ...position }, elapsed: 0, life, color });
    this.rings = this.rings.slice(-32);
  }
  private popup(position: Position, value: string, color: string) {
    if (this.popups.length >= 8) this.popups.shift()!.text.destroy();
    const text = this.scene.add
      .text(position.x * C.tileSize, position.y * C.tileSize - 28, value, {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color,
        stroke: "#fff9e8",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(22000);
    this.popups.push({ text, elapsed: 0 });
  }
  private event(event: PresentationEvent) {
    const p = event.position;
    if (event.kind === "explode" && p) this.burst(p, "art-drop", 15);
    else if (event.kind === "kill" && p) {
      if (event.value) this.popup(p, `+${event.value}`, "#477d72");
      else this.burst(p, "art-star", 9, 0xb2ef91);
    } else if (event.kind === "golden" && p) {
      this.burst(p, "art-star", 22);
      this.ring(p, 0xffd568, 1000);
      this.popup(p, "GOLDEN!", "#b68b2d");
    } else if (event.kind === "pickup" && p) {
      if (event.value === 0) this.burst(p, "art-wood", 8);
      else {
        this.burst(p, "art-star", 6);
        this.ring(p, 0xffd46a, 450);
      }
    } else if (event.kind === "trap" && p) {
      this.burst(p, "art-drop", 8);
      this.ring(p, 0x83dcff);
    } else if (event.kind === "defeat" && p)
      this.burst(p, "art-star", 9, event.team === "red" ? 0xffa89a : 0x99edd0);
    else if (event.kind === "respawn" && p) {
      this.ring(p, 0xaff0dc);
      this.burst(p, "art-star", 12, 0xc8f8ee);
    } else if (event.kind === "combo" && p)
      this.popup({ x: p.x, y: p.y - 0.35 }, `${event.value} COMBO!`, "#bf8051");
    else if (event.kind === "finish")
      for (const position of [
        { x: 2.5, y: 3 },
        { x: 12.5, y: 3 },
      ])
        this.burst(position, "art-star", 26);
  }
  private effects(delta: number) {
    const dt = delta / 1000;
    this.particles = this.particles.filter((p) => {
      p.elapsed += delta;
      if (p.elapsed >= p.life) {
        p.image.destroy();
        return false;
      }
      p.vy += 100 * dt;
      p.image.x += p.vx * dt;
      p.image.y += p.vy * dt;
      p.image.rotation += p.spin * dt;
      p.image.setAlpha(1 - p.elapsed / p.life);
      return true;
    });
    for (const ring of this.rings) {
      ring.elapsed += delta;
      const t = ring.elapsed / ring.life;
      this.overlays.lineStyle(2.5, ring.color, Math.max(0, 1 - t));
      this.overlays.strokeEllipse(
        ring.position.x * C.tileSize,
        ring.position.y * C.tileSize + 6,
        12 + t * 55,
        5 + t * 24,
      );
    }
    this.rings = this.rings.filter((r) => r.elapsed < r.life);
    this.popups = this.popups.filter((p) => {
      p.elapsed += delta;
      if (p.elapsed >= 800) {
        p.text.destroy();
        return false;
      }
      p.text.y -= 16 * dt;
      p.text.setAlpha(1 - p.elapsed / 800);
      return true;
    });
    this.parent.dataset.presentationParticles = String(this.particles.length);
  }
  private player(state: PracticeState, p: PracticePlayer) {
    const finished = state.round?.phase === "FINISHED",
      winner = state.round?.winner;
    const won = finished && winner === p.team,
      lost = finished && winner !== "draw" && winner !== p.team;
    const drowning =
      p.status === "respawning" &&
      state.time < p.statusUntil - C.respawnMs + 600;
    const pose: Pose = drowning
      ? "trapped"
      : won
        ? "win"
        : lost
          ? "lose"
          : p.status === "trapped"
            ? "trapped"
            : p.status === "respawning"
              ? "defeat"
              : p.moving
                ? "walk"
                : "idle";
    const facing = pose === "trapped" || finished ? "down" : p.facing;
    const frame =
      Math.floor(
        this.clock / (pose === "walk" ? 105 : pose === "idle" ? 450 : 170),
      ) % 4;
    const actor = this.actor(
      this.players,
      p.id,
      p.characterId === undefined
        ? keyPlayer(p.team, pose, facing, frame)
        : keyCharacter(p.characterId, facing === "left", p.moving ? frame : 0),
      ART.playerWidth,
      ART.playerHeight,
    );
    if (actor.status !== p.status) {
      actor.status = p.status;
      actor.changedAt = this.clock;
    }
    const since = this.clock - actor.changedAt;
    const dying = p.status === "respawning",
      fade = dying ? Math.max(0, 1 - Math.max(0, since - 600) / 1200) : 1;
    const spawn =
      !dying && p.invulnerableUntil > state.time && since < 300
        ? Math.max(0.25, since / 300)
        : 1;
    const invincible =
      p.invulnerableUntil > state.time &&
      !dying &&
      Math.floor(this.clock / 110) % 2 === 0;
    const bob = won ? Math.abs(Math.sin(this.clock / 180)) * 3 : 0;
    actor.image
      .setVisible(fade > 0)
      .setPosition(p.position.x * C.tileSize, p.position.y * C.tileSize - bob)
      .setDisplaySize(ART.playerWidth * spawn, ART.playerHeight * spawn)
      .setAngle(dying ? Math.min(90, Math.max(0, since - 600) / 6) : 0)
      .setAlpha(
        fade *
          ((p.ghostUntil ?? 0) > state.time
            ? p.id === this.playerId
              ? 0.25
              : 0
            : invincible
              ? 0.5
              : 1),
      )
      .setDepth(p.position.y * C.tileSize + 1);
    actor.shadow
      .setPosition(p.position.x * C.tileSize, p.position.y * C.tileSize + 5)
      .setAlpha((p.ghostUntil ?? 0) > state.time ? 0 : fade * 0.85)
      .setDepth(p.position.y * C.tileSize - 1);
    const x = p.position.x * C.tileSize,
      y = p.position.y * C.tileSize - 13;
    if ((p.ghostUntil ?? 0) > state.time && p.id !== this.playerId) return;
    if (p.status === "trapped" || drowning) {
      const urgency = drowning
        ? 1
        : Math.max(0, 1 - (p.statusUntil - state.time) / C.trappedMs);
      const pulse = Math.sin(this.clock / (180 - urgency * 130));
      actor.image
        .setX(x + pulse * urgency * 3)
        .setTint(0xffffff - Math.floor(urgency * 90) * 0x010100);
      for (let i = 0; i < 5; i++) {
        const rise = (this.clock / (18 - urgency * 10) + i * 11) % 50;
        this.overlays.lineStyle(1, 0xd9faff, 0.8);
        this.overlays.strokeCircle(
          x + Math.sin(i * 7 + rise / 9) * 12,
          y + 20 - rise,
          1 + urgency * 2,
        );
      }
      this.overlays.fillStyle(0xa4e7ff, 0.24);
      this.overlays.lineStyle(2, 0x56b4e1, 0.95);
      this.overlays.fillEllipse(x, y, 44, 50);
      this.overlays.strokeEllipse(x, y, 44, 50);
      this.overlays.lineStyle(3, 0xe7fcff, 0.9);
      this.overlays.beginPath();
      this.overlays.arc(x, y, 18, 3.7, 4.8);
      this.overlays.strokePath();
      this.overlays.fillStyle(0xffffff, 0.8);
      this.overlays.fillCircle(x - 13, y - 13, 3);
      // Remaining breath: five segments disappear one per second.
      for (
        let i = 0;
        !drowning && i < Math.ceil((p.statusUntil - state.time) / 1000);
        i++
      ) {
        this.overlays.fillStyle(urgency > 0.6 ? 0xff7777 : 0x89e8ff, 0.95);
        this.overlays.fillCircle(x - 12 + i * 6, y - 30, 2);
      }
    } else {
      actor.image.clearTint();
      if (dying && since >= 600 && since < 1050) {
        this.overlays.lineStyle(2, 0xa4e7ff, 1 - (since - 600) / 450);
        this.overlays.strokeCircle(x, y, 22 + (since - 600) / 14);
      }
    }
    if (p.shieldUntil > state.time) {
      this.overlays.lineStyle(2, 0x9bdfff, 0.75);
      this.overlays.strokeEllipse(
        x,
        y + 1,
        49 + Math.sin(this.clock / 160) * 2,
        58,
      );
    }
    if (p.powerUntil > state.time) {
      this.overlays.lineStyle(2, 0xffcc5a, 0.9);
      this.overlays.strokeEllipse(
        x,
        y + 20,
        37 + Math.sin(this.clock / 100) * 3,
        11,
      );
    }
  }
  private blasts(state: PracticeState) {
    const g = this.water;
    g.clear();
    const tile = C.tileSize;
    for (const blast of state.blasts) {
      const cells = new Set(blast.cells.map((c) => `${c.x},${c.y}`));
      for (const cell of blast.cells) {
        const x = (cell.x + 0.5) * tile,
          y = (cell.y + 0.5) * tile;
        // The translucent tile base is exactly the logical hit area.
        g.fillStyle(0x51c6ed, 0.28);
        g.fillRect(cell.x * tile, cell.y * tile, tile, tile);
        const left = cells.has(`${cell.x - 1},${cell.y}`),
          right = cells.has(`${cell.x + 1},${cell.y}`),
          up = cells.has(`${cell.x},${cell.y - 1}`),
          down = cells.has(`${cell.x},${cell.y + 1}`);
        g.lineStyle(26, 0x299fd8, 0.92);
        g.lineBetween(
          left ? x - tile / 2 : x - 1,
          y,
          right ? x + tile / 2 : x + 1,
          y,
        );
        g.lineBetween(
          x,
          up ? y - tile / 2 : y - 1,
          x,
          down ? y + tile / 2 : y + 1,
        );
        g.fillStyle(0x4ed5f1, 0.98);
        g.fillRoundedRect(
          left ? x - 20 : x - 13,
          y - 11,
          left || right ? (left && right ? 40 : 33) : 26,
          22,
          8,
        );
        if (up || down)
          g.fillRoundedRect(
            x - 11,
            up ? y - 20 : y - 13,
            22,
            up && down ? 40 : 33,
            8,
          );
        g.lineStyle(8, 0xc6fcff, 0.92);
        if (left || right)
          g.lineBetween(left ? x - 20 : x - 5, y, right ? x + 20 : x + 5, y);
        if (up || down)
          g.lineBetween(x, up ? y - 20 : y - 5, x, down ? y + 20 : y + 5);
        if (cell.x === blast.cells[0].x && cell.y === blast.cells[0].y) {
          g.fillStyle(0xe1ffff);
          g.fillCircle(x, y, 11);
          g.lineStyle(2, 0xffffff, 0.8);
          g.strokeCircle(x, y, 15 + Math.sin(this.clock / 50));
        }
        g.fillStyle(0xffffff, 0.9);
        for (let i = 0; i < 3; i++)
          g.fillCircle(
            x - 12 + ((i * 11 + this.clock / 30) % 24),
            y - 10 + ((i * 8 + this.clock / 40) % 20),
            1.5,
          );
      }
    }
  }
  update(state: PracticeState, elapsed: number) {
    const delta = Math.min(Math.max(elapsed, 0), 100);
    this.clock += delta;
    const phase = state.round?.phase ?? "PRACTICE";
    if (
      this.sound &&
      (state.time < this.lastTime ||
        (this.lastPhase === "FINISHED" && phase === "PLAYING"))
    )
      arcadeAudio.beginSession();
    if (this.sound && phase === "FINISHED" && this.lastPhase !== "FINISHED")
      arcadeAudio.result();
    this.lastTime = state.time;
    this.lastPhase = phase;
    const events = this.tracker.observe(state);
    for (const event of events) this.event(event);
    if (this.sound) arcadeAudio.events(events);
    this.blocksFrom(state);
    this.overlays.clear();
    this.blasts(state);
    this.prune(this.players, new Set(state.players.map((p) => p.id)));
    for (const p of state.players) this.player(state, p);
    this.prune(this.monsters, new Set(state.round?.monsters.map((m) => m.id)));
    for (const m of state.round?.monsters ?? []) {
      const frame =
        Math.floor(
          this.clock /
            (m.kind === "chaser" ? 85 : m.kind === "golden" ? 125 : 170) +
            m.id,
        ) % 4;
      const actor = this.actor(
        this.monsters,
        m.id,
        `art-monster-${m.kind}-${frame}`,
        ART.monsterWidth,
        ART.monsterHeight,
        0.86,
      );
      actor.image
        .setDisplaySize(ART.monsterWidth, ART.monsterHeight)
        .setPosition(m.position.x * C.tileSize, m.position.y * C.tileSize)
        .setDepth(m.position.y * C.tileSize + 0.5);
      actor.shadow
        .setDisplaySize(24, 9)
        .setPosition(m.position.x * C.tileSize, m.position.y * C.tileSize + 5)
        .setDepth(m.position.y * C.tileSize - 0.5);
    }
    this.prune(this.balloons, new Set(state.balloons.map((b) => b.id)));
    for (const b of state.balloons) {
      const actor = this.actor(this.balloons, b.id, "art-balloon", 37, 39, 0.5),
        pulse =
          1 +
          Math.sin(this.clock / (b.explodesAt - state.time < 600 ? 48 : 160)) *
            0.055,
        x = (b.x + 0.5) * C.tileSize,
        y = (b.y + 0.5) * C.tileSize;
      const urgency = Math.max(
        0,
        Math.min(1, 1 - (b.explodesAt - state.time) / C.balloonFuseMs),
      );
      const shimmer =
        this.clock / (b.explodesAt - state.time < 600 ? 48 : 180) + b.id * 1.7;
      const bob = Math.sin(shimmer) * (0.6 + urgency * 0.8);
      actor.image
        .setPosition(x, y - 1 - bob)
        .setAngle(Math.sin(shimmer * 0.7) * (0.5 + urgency))
        .setDisplaySize(37 * pulse, 39 / pulse)
        .setDepth(y);
      actor.shadow
        .setPosition(x, y + 13)
        .setDisplaySize(26 * pulse, 9 / pulse)
        .setAlpha(0.75)
        .setDepth(1);
      for (let glint = 0; glint < 2; glint++) {
        const light =
          0.3 +
          0.7 * Math.max(0, Math.sin(this.clock / 210 + b.id + glint * 2.7));
        const gx = x + (glint ? 7 : -5),
          gy = y + (glint ? 3 : -7) - bob;
        this.overlays.lineStyle(1, 0xffffff, light);
        this.overlays.lineBetween(gx - 2 * light, gy, gx + 2 * light, gy);
        this.overlays.lineBetween(gx, gy - 2 * light, gx, gy + 2 * light);
      }
    }
    this.prune(this.items, new Set(state.items.map((i) => i.id)));
    for (const item of state.items) {
      const actor = this.actor(
          this.items,
          item.id,
          `art-item-${item.kind}`,
          27,
          28.5,
          0.8,
        ),
        x = (item.x + 0.5) * C.tileSize,
        y = (item.y + 0.5) * C.tileSize;
      actor.image
        .setPosition(x, y + 7 + Math.sin(this.clock / 200 + item.id) * 1.5)
        .setDisplaySize(27, 28.5)
        .setAlpha(item.availableAt > state.time ? 0.45 : 1)
        .setDepth(y);
      actor.shadow
        .setPosition(x, y + 13)
        .setDisplaySize(20, 7)
        .setDepth(1);
    }
    this.effects(delta);
  }
  reset() {
    this.tracker.reset();
    this.revision = -1;
    this.lastTime = -1;
    this.lastPhase = "";
    for (const map of [
      this.players,
      this.monsters,
      this.balloons,
      this.items,
    ]) {
      for (const actor of map.values()) {
        actor.image.destroy();
        actor.shadow.destroy();
      }
      map.clear();
    }
    for (const p of this.particles) p.image.destroy();
    for (const p of this.popups) p.text.destroy();
    this.particles = [];
    this.popups = [];
    this.rings = [];
  }
  destroy() {
    this.reset();
    for (const floor of this.floors) floor.destroy();
    for (const block of this.blocks.values()) block.image.destroy();
    this.blocks.clear();
    this.water.destroy();
    this.overlays.destroy();
  }
}
