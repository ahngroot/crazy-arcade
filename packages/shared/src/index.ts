/** Provisional design values, not verified original-game measurements. */
export const GAME_CONFIG = Object.freeze({
  columns: 15,
  rows: 13,
  tileSize: 40,
  maxPlayers: 2,
  roundMs: 180_000,
  movementTilesPerSecond: 3,
  balloonFuseMs: 2_500,
  blastMs: 500,
  initialBalloons: 1,
  initialRange: 1,
  playerRadius: 0.28,
  cornerAssist: 0.23,
  fixedStepMs: 1000 / 60,
  maxFrameMs: 250,
  trappedMs: 1500,
  respawnMs: 800,
  invulnerableMs: 1500,
  itemDropChance: 0.45,
  maxBalloons: 6,
  maxRange: 6,
  maxSpeed: 6,
  speedIncrement: 0.5,
  comboWindowMs: 3_000,
  goldenCombo: 8,
  chaserThreshold: 4,
  monsterInitialPerTeam: 2,
  monsterSpeed: 0.85,
  chaserSpeed: 1.35,
  goldenSpeed: 1.1,
  monsterRadius: 0.23,
  monsterSpawnProtectionMs: 600,
  monsterSpawnSafeDistance: 1.7,
  monsterSpawnCheckMs: 250,
  monsterEarlyIntervalMs: 7000,
  monsterMiddleIntervalMs: 4000,
  monsterLateIntervalMs: 1400,
  monsterMiddleAtMs: 60_000,
  rushWarningMs: 30_000,
  finalWarningMs: 15_000,
  maxMonstersPerTeam: 22,
  maxSpawnQueuePerTeam: 32,
  maxChasersPerTeam: 3,
  normalScore: 1,
  chaserScore: 3,
  goldenScore: 10,
  comboBonus: 1,
  goldenRewardItem: true,
  inventoryLimit: 3,
  shieldMs: 4000,
  needleProtectionMs: 900,
  powerMs: 6000,
  powerSpeedBonus: 1.5,
  powerRangeBonus: 2,
  powerCapacityBonus: 2,
  competitionSeed: 2701,
  simulationHz: 30,
  snapshotHz: 20,
  reconnectGraceMs: 30_000,
});
export type Team = "red" | "green";
export type RoomPhase =
  "WAITING" | "READY" | "COUNTDOWN" | "PLAYING" | "FINISHED";
export type Tile = "floor" | "wall" | "crate";
export interface Position {
  x: number;
  y: number;
}

export * from "./game.js";
export * from "./competition.js";
export interface PlayerState {
  id: string;
  nickname: string;
  team: Team;
  position: Position;
  score: number;
  ready: boolean;
  status: "active" | "trapped" | "respawning";
}
export interface PlayerInput {
  sequence: number;
  x: number;
  y: number;
  balloon: boolean;
}
export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  tick: number;
  serverTime: number;
  players: PlayerState[];
}
export interface ServerHello {
  protocol: 1;
  stage: 1;
  maxPlayers: number;
}
export interface ServerEvents {
  hello: (message: ServerHello) => void;
}
export interface ClientEvents {
  pingCheck: (reply: (serverTime: number) => void) => void;
}

/** Symmetric arena shared by the menu preview and the practice simulation. */
export function createPreviewMap(): Tile[][] {
  return Array.from({ length: GAME_CONFIG.rows }, (_, y) =>
    Array.from({ length: GAME_CONFIG.columns }, (_, x): Tile => {
      const mirrorX = Math.min(x, GAME_CONFIG.columns - 1 - x);
      if (
        x === 0 ||
        y === 0 ||
        x === GAME_CONFIG.columns - 1 ||
        y === GAME_CONFIG.rows - 1 ||
        x === Math.floor(GAME_CONFIG.columns / 2)
      )
        return "wall";
      if (mirrorX === 1 && y <= 2) return "floor";
      if (mirrorX % 2 === 0 && y % 2 === 0) return "wall";
      return (mirrorX + y) % 3 === 0 ? "crate" : "floor";
    }),
  );
}
