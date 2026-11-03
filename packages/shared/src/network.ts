import type { LocalInput, PracticeState } from "./game.js";
import type { RoomPhase, Team } from "./index.js";
export interface NetworkInput extends LocalInput {
  sequence: number;
  roundId: number;
}
export interface RoomMember {
  id: string;
  nickname: string;
  team: Team;
  connected: boolean;
  ready: boolean;
  reconnectUntil: number | null;
  ack: number;
}
export interface RoomView {
  code: string;
  phase: RoomPhase;
  roundId: number;
  tick: number;
  serverTime: number;
  countdownEndsAt: number | null;
  paused: boolean;
  reason: string | null;
  players: RoomMember[];
  game: PracticeState | null;
}
export type ActionResult = { ok: true } | { ok: false; error: string };
export type AdmissionResult =
  | { ok: true; token: string; playerId: string; room: RoomView }
  | { ok: false; error: string };
