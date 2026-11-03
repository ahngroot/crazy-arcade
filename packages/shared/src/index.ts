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
  comboWindowMs: 3_000,
  goldenCombo: 8,
  chaserThreshold: 4,
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

/** Rendering fixture only. Future simulation will own maps and collisions. */
export function createPreviewMap(): Tile[][] {
  return Array.from({ length: GAME_CONFIG.rows }, (_, y) =>
    Array.from({ length: GAME_CONFIG.columns }, (_, x): Tile => {
      const mirrorX = Math.min(x, GAME_CONFIG.columns - 1 - x);
      if (x === 0 || y === 0 || x === 14 || y === 12 || x === 7) return "wall";
      if (mirrorX === 1 && y <= 2) return "floor";
      if (mirrorX % 2 === 0 && y % 2 === 0) return "wall";
      return (mirrorX + y) % 3 === 0 ? "crate" : "floor";
    }),
  );
}
