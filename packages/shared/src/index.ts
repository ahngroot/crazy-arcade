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
  gridTurnAssistTiles: 0.16,
  gridTurnAssistSpeed: 1.6,
  turnBufferMs: 350,
  fixedStepMs: 1000 / 60,
  maxFrameMs: 250,
  trappedMs: 5000,
  trappedSpeedMultiplier: 0.8 / 3,
  respawnMs: 1800,
  deathDropPickupDelayMs: 500,
  deathDropRatio: 0.8,
  invulnerableMs: 1500,
  itemDropChance: 0.45,
  itemLifetimeMs: 15000,
  itemFadeMs: 3000,
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
  arenaSpawnMinDistance: 4,
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
  inventoryLimit: 2,
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
  countdownMs: 3000,
  emptyRoomTtlMs: 60_000,
  inputTimeoutMs: 300,
  interpolationMs: 100,
  correctionMs: 65,
  maxPendingInputs: 120,
  maxRooms: 200,
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
export * from "./characters.js";
export * from "./maps.js";
export * from "./competition.js";
export * from "./network.js";
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
export interface ServerHello {
  protocol: 1;
  stage: 1;
  maxPlayers: number;
}
export interface ServerEvents {
  hello: (message: ServerHello) => void;
  room: (view: import("./network.js").RoomView) => void;
  roomClosed: (reason: string) => void;
}
export interface ClientEvents {
  pingCheck: (reply: (serverTime: number) => void) => void;
  createRoom: (
    request: unknown,
    reply: (response: import("./network.js").AdmissionResult) => void,
  ) => void;
  joinRoom: (
    request: unknown,
    reply: (response: import("./network.js").AdmissionResult) => void,
  ) => void;
  resumeRoom: (
    request: unknown,
    reply: (response: import("./network.js").AdmissionResult) => void,
  ) => void;
  readyRoom: (
    ready: unknown,
    reply: (response: import("./network.js").ActionResult) => void,
  ) => void;
  leaveRoom: (
    reply: (response: import("./network.js").ActionResult) => void,
  ) => void;
  input: (packet: unknown) => void;
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

/** Classic battle layout: shared arena, fixed pillars, crates and safe corner starts. */
export function createBattleMap(): Tile[][] {
  const { columns, rows } = GAME_CONFIG;
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: columns }, (_, x): Tile => {
      if (x === 0 || y === 0 || x === columns - 1 || y === rows - 1)
        return "wall";
      if (x % 2 === 0 && y % 2 === 0) return "wall";
      const cx = Math.min(x, columns - 1 - x);
      const cy = Math.min(y, rows - 1 - y);
      if ((cx === 1 && cy <= 2) || (cy === 1 && cx <= 2)) return "floor";
      return (cx * 7 + cy * 11) % 5 === 0 ? "floor" : "crate";
    }),
  );
}
