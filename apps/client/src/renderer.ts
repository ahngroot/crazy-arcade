import Phaser from "phaser";
import {
  GAME_CONFIG as C,
  arenaById,
  type PracticeState,
  type PracticePlayer,
  type Position,
} from "@bubble/shared";
import {
  ART,
  installArt,
  keyPlayer,
  characterTexture,
  safeTexture,
  type Pose,
  type MapPalette,
} from "./art";
import { PresentationTracker, type PresentationEvent } from "./presentation";
import { arcadeAudio } from "./audio";

type Actor = {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  status: string;
  changedAt: number;
  bubblePopped?: boolean;
  trapUntil?: number;
  trapVariant?: number;
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
  private foam = new Map<string, Phaser.GameObjects.Image>();
  private monsters = new Map<number, Actor>();
  private balloons = new Map<number, Actor>();
  private items = new Map<number, Actor>();
  private blocks = new Map<
    string,
    { kind: string; image: Phaser.GameObjects.Image }
  >();
  private floors: Phaser.GameObjects.Image[] = [];
  private decorations: Phaser.GameObjects.Image[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private water: Phaser.GameObjects.Graphics;
  private streams = new Map<string, Phaser.GameObjects.Image>();
  private overlays: Phaser.GameObjects.Graphics;
  private revision = -1;
  private clock = 0;
  private lastTime = -1;
  private lastPhase = "";
  private terrain = "";
  private selfArrow: Phaser.GameObjects.Image;
  constructor(
    private scene: Phaser.Scene,
    private parent: HTMLElement,
    private sound = true,
    private playerId = "p1",
    mapPalette: MapPalette = "pastel",
  ) {
    installArt(scene, mapPalette);
    this.selfArrow = this.image("art-self-arrow", 14, 20)
      .setDepth(23000)
      .setVisible(false);
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
    this.parent.dataset.mapRevision = String(state.mapRevision);
    const arena = arenaById(state.arenaId);
    const terrain = state.arenaId ?? state.terrain ?? "garden";
    if (terrain !== this.terrain) {
      this.terrain = terrain;
      this.parent.dataset.mapTheme = arena ? "themed" : terrain;
      this.parent.dataset.mapId = arena?.id ?? "legacy";
      this.parent.dataset.mapName =
        arena?.name ?? (terrain === "battle" ? "일반 연습 맵" : "클로버 정원");
      this.floors.forEach((floor, i) => {
        const x = i % C.columns,
          y = Math.floor(i / C.columns);
        floor.setTexture(
          arena
            ? `art-arena-${arena.theme}-${(arena.id === "toy-village" && x >= 6 && x <= 8) || arena.rows[y][x] === "r" ? 7 : arena.theme >= 3 && (x + y) % 2 === 0 ? 7 : 0}`
            : terrain === "battle"
              ? `art-ground-battle-${(x + y) % 2}`
              : `art-ground-${x < 7 ? "red" : "green"}-${(x + y) % 2}`,
        );
        floor.setTint(arena?.theme === 6 ? 0x9b9fa4 : 0xffffff);
      });
      for (const block of this.blocks.values()) block.image.destroy();
      this.blocks.clear();
      for (const image of this.decorations) image.destroy();
      this.decorations = [];
      for (const decoration of arena?.decorations ?? []) {
        const key =
          decoration.kind === "pond"
            ? `art-arena-${arena!.theme}-4`
            : `art-arena-${decoration.kind}`;
        this.decorations.push(
          this.scene.add
            .image(decoration.x * C.tileSize, decoration.y * C.tileSize, key)
            .setOrigin(0, 0)
            .setDisplaySize(
              decoration.width * C.tileSize,
              decoration.height * C.tileSize,
            )
            .setDepth(
              decoration.kind === "mast"
                ? (decoration.y + decoration.height) * C.tileSize - 4
                : 0.5,
            )
            .setAlpha(decoration.kind === "lion" ? 0.65 : 1),
        );
      }
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
                  arena
                    ? "mp".includes(arena.rows[y][x])
                      ? "art-arena-hidden"
                      : `art-arena-${arena.theme}-${arena.theme === 3 && arena.rows[y][x] === "c" ? 1 : (({ b: 1, c: 2, t: 5, w: 3, h: 4, d: 6, v: 3 } as Record<string, number>)[arena.rows[y][x]] ?? (tile === "wall" ? 3 : 1))}`
                    : terrain === "battle"
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
    const deathElapsed = Math.max(
      0,
      C.respawnMs - (p.statusUntil - state.time),
    );
    const dying = p.status === "respawning";
    const drowning = dying && deathElapsed < 600;
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
    const previous = this.players.get(p.id);
    const trapUntil =
      p.status === "trapped"
        ? p.statusUntil
        : (previous?.trapUntil ?? p.statusUntil - C.respawnMs);
    let trapVariant = previous?.trapVariant ?? 0;
    if (pose === "trapped" && previous?.trapUntil !== trapUntil) {
      // A visual coin toss from shared trap identity: both peers/reconnections agree.
      // Do not consume the authoritative RNG or reroll during the same trap.
      let hash = 2166136261;
      for (const char of `${p.id}:${Math.round(trapUntil * 1000)}`)
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      hash ^= hash >>> 16;
      trapVariant = hash & 1;
    }
    const trappedKey = trapVariant ? "art-trapped-alt" : "art-trapped";
    const foamKey = trapVariant ? "art-trapped-white-alt" : "art-trapped-white";
    const actor = this.actor(
      this.players,
      p.id,
      pose === "trapped"
        ? trappedKey
        : dying
          ? `art-prone-${p.characterId ?? 0}`
          : p.characterId === undefined
            ? keyPlayer(p.team, pose, facing, frame)
            : characterTexture(
                p.characterId,
                facing,
                pose === "walk" ? frame : 0,
              ),
      ART.playerWidth,
      ART.playerHeight,
    );
    if (pose === "trapped") {
      actor.trapUntil = trapUntil;
      actor.trapVariant = trapVariant;
    }
    if (actor.status !== p.status) {
      actor.status = p.status;
      actor.changedAt = this.clock;
      actor.bubblePopped = false;
    }
    const since = this.clock - actor.changedAt;
    const fade = dying
      ? Math.max(0, 1 - Math.max(0, deathElapsed - 1100) / 700)
      : 1;
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
      .setAngle(0)
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
    if (p.id === this.playerId && !dying)
      this.selfArrow
        .setVisible(true)
        .setPosition(x, Math.max(11, p.position.y * C.tileSize - 61 - bob));
    if ((p.ghostUntil ?? 0) > state.time && p.id !== this.playerId) return;
    if (p.status === "trapped" || drowning) {
      const urgency = drowning
        ? 1
        : Math.max(0, 1 - (p.statusUntil - state.time) / C.trappedMs);
      const pulse = Math.sin(this.clock / (180 - urgency * 130));
      actor.image
        .clearTint()
        .setX(x + pulse * urgency * 1.5)
        .setDisplaySize(
          ART.playerWidth * (1 + pulse * urgency * 0.035),
          ART.playerHeight * (1 - pulse * urgency * 0.025),
        );
      let foam = this.foam.get(p.id);
      if (!foam) {
        foam = this.scene.add.image(0, 0, foamKey).setOrigin(0.5, 0.9);
        this.foam.set(p.id, foam);
      }
      foam
        .setTexture(foamKey)
        .setPosition(actor.image.x, actor.image.y)
        .setDisplaySize(actor.image.displayWidth, actor.image.displayHeight)
        .setDepth(actor.image.depth + 0.1)
        .setVisible(true)
        .setAlpha(Math.min(1, urgency * urgency * (drowning ? 1 : 0.95)));
      for (let i = 0; i < 5; i++) {
        const rise = (this.clock / (18 - urgency * 10) + i * 11) % 50;
        this.overlays.lineStyle(1, 0xd9faff, 0.8);
        this.overlays.strokeCircle(
          x + Math.sin(i * 7 + rise / 9) * 12,
          y + 20 - rise,
          1 + urgency * 2,
        );
      }
    } else {
      this.foam.get(p.id)?.setVisible(false);
      actor.image.clearTint();
      if (dying && !actor.bubblePopped) {
        actor.bubblePopped = true;
        this.burst(p.position, "art-drop", 18, 0xe7fbff);
        this.ring(p.position, 0xf5ffff, 450);
      }
      if (dying && deathElapsed >= 600 && deathElapsed < 1050) {
        this.overlays.lineStyle(2, 0xa4e7ff, 1 - (deathElapsed - 600) / 450);
        this.overlays.strokeCircle(x, y, 22 + (deathElapsed - 600) / 14);
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
    const live = new Set<string>();
    for (const blast of state.blasts) {
      const cells = new Set(blast.cells.map((c) => `${c.x},${c.y}`));
      const origin = blast.cells[0];
      for (const cell of blast.cells) {
        const key = `${blast.id}:${cell.x},${cell.y}`;
        live.add(key);
        const dx = Math.sign(cell.x - origin.x),
          dy = Math.sign(cell.y - origin.y);
        const center = dx === 0 && dy === 0;
        const end = !center && !cells.has(`${cell.x + dx},${cell.y + dy}`);
        const kind = center
          ? blast.cells.length === 1
            ? "single"
            : "center"
          : end
            ? "cap"
            : "body";
        let sprite = this.streams.get(key);
        if (!sprite) {
          sprite = this.scene.add
            .image(0, 0, `art-stream-${kind}`)
            .setDisplaySize(C.tileSize, C.tileSize)
            .setDepth(2);
          this.streams.set(key, sprite);
        }
        sprite
          .setTexture(`art-stream-${kind}`)
          .setPosition((cell.x + 0.5) * C.tileSize, (cell.y + 0.5) * C.tileSize)
          .setAngle(center ? 0 : dx > 0 ? 90 : dx < 0 ? -90 : dy > 0 ? 180 : 0)
          .setAlpha(0.94 + Math.sin(this.clock / 55) * 0.06);
      }
    }
    for (const [key, image] of this.streams)
      if (!live.has(key)) {
        image.destroy();
        this.streams.delete(key);
      }
  }

  update(state: PracticeState, elapsed: number) {
    this.selfArrow.setVisible(false);
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
    const playerIds = new Set(state.players.map((p) => p.id));
    for (const [id, image] of this.foam)
      if (!playerIds.has(id)) {
        image.destroy();
        this.foam.delete(id);
      }
    this.prune(this.players, playerIds);
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
      const actor = this.actor(this.balloons, b.id, "art-balloon", 40.7, 42.9, 0.5),
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
      // A visible lift from the fixed cell, with a shadow that stays on the floor.
      const bounce = (Math.sin(this.clock / 140 + b.id * 1.7) + 1) / 2;
      const bob = bounce * (4 + urgency * 2);
      actor.image
        .setPosition(x, y - 1 - bob)
        .setAngle(Math.sin(shimmer * 0.7) * (0.5 + urgency))
        .setDisplaySize(40.7 * pulse, 42.9 / pulse)
        .setDepth(y);
      actor.shadow
        .setPosition(x, y + 13)
        .setDisplaySize((26 - bob * 0.9) * pulse, (9 - bob * 0.25) / pulse)
        .setAlpha(0.75 - bob * 0.035)
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
        flight = item.flight,
        progress = flight
          ? Phaser.Math.Clamp(
              (state.time - flight.startedAt) /
                (flight.landsAt - flight.startedAt),
              0,
              1,
            )
          : 1,
        x =
          ((flight ? flight.from.x * (1 - progress) : 0) +
            (item.x + 0.5) * (flight ? progress : 1)) *
          C.tileSize,
        y =
          ((flight ? flight.from.y * (1 - progress) : 0) +
            (item.y + 0.5) * (flight ? progress : 1)) *
          C.tileSize,
        lift =
          progress < 1
            ? Math.sin(Math.PI * progress) * (65 + (item.id % 3) * 12)
            : 0;
      actor.image
        .setData("itemId", item.id)
        .setPosition(
          x,
          y +
            7 -
            lift +
            (progress === 1 ? Math.sin(this.clock / 200 + item.id) * 1.5 : 0),
        )
        .setDisplaySize(42.525, 44.8875)
        .setAngle(progress < 1 ? Math.sin(progress * Math.PI * 2) * 25 : 0)
        .setAlpha(
          (progress < 1 || item.availableAt <= state.time ? 1 : 0.6) *
            (item.expiresAt === undefined
              ? 1
              : Phaser.Math.Clamp(
                  (item.expiresAt - state.time) / C.itemFadeMs,
                  0,
                  1,
                )),
        )
        .setDepth(progress < 1 ? 15000 + y : y);
      actor.shadow
        .setPosition(x, y + 13)
        .setDisplaySize(30 - lift * 0.12, 10.5 - lift * 0.035)
        .setAlpha(
          (0.65 - lift * 0.004) *
            (item.expiresAt === undefined
              ? 1
              : Phaser.Math.Clamp(
                  (item.expiresAt - state.time) / C.itemFadeMs,
                  0,
                  1,
                )),
        )
        .setDepth(1);
    }
    this.effects(delta);
  }
  reset() {
    this.selfArrow.setVisible(false);
    this.tracker.reset();
    for (const image of this.foam.values()) image.destroy();
    this.foam.clear();
    for (const image of this.streams.values()) image.destroy();
    this.streams.clear();
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
    for (const image of this.decorations) image.destroy();
    for (const block of this.blocks.values()) block.image.destroy();
    this.blocks.clear();
    this.water.destroy();
    this.overlays.destroy();
    this.selfArrow.destroy();
  }
}
