import type { PracticeState, Position, Team } from "@bubble/shared";

export type Cue =
  | "place"
  | "explode"
  | "kill"
  | "combo"
  | "golden"
  | "pickup"
  | "trap"
  | "defeat"
  | "respawn"
  | "finish"
  | "warning";
export interface PresentationEvent {
  kind: Cue;
  position?: Position;
  team?: Team;
  value?: number;
}
type PlayerRecord = {
  status: string;
  deaths: number;
  combo: number;
  score: number;
  upgrades: number[];
  buffs: number;
};
interface FrameRecord {
  time: number;
  tick: number;
  phase: string;
  warning: string;
  balloons: Set<number>;
  blasts: Set<number>;
  events: Set<number>;
  crates: Set<string>;
  players: Map<string, PlayerRecord>;
}

/** Observes confirmed state. Stores copies of facts, never changes or owns game rules. */
export class PresentationTracker {
  private previous: FrameRecord | null = null;
  reset() {
    this.previous = null;
  }
  observe(state: PracticeState): PresentationEvent[] {
    const next: FrameRecord = {
      time: state.time,
      tick: state.tick,
      phase: state.round?.phase ?? "PRACTICE",
      warning: state.round?.warning ?? "normal",
      balloons: new Set(state.balloons.map((b) => b.id)),
      blasts: new Set(state.blasts.map((b) => b.id)),
      events: new Set(state.round?.events.map((e) => e.id)),
      crates: new Set(
        state.map.flatMap((row, y) =>
          row.flatMap((tile, x) => (tile === "crate" ? [`${x},${y}`] : [])),
        ),
      ),
      players: new Map(
        state.players.map((p) => [
          p.id,
          {
            status: p.status,
            deaths: p.deaths,
            combo: p.combo,
            score: p.score,
            upgrades: [
              p.capacity,
              p.range,
              p.speed,
              ...(["needle", "shield", "power"] as const).map(
                (kind) => p.inventory.filter((item) => item === kind).length,
              ),
            ],
            buffs: p.shieldUntil + p.powerUntil,
          },
        ]),
      ),
    };
    const old = this.previous;
    this.previous = next;
    // Baseline on mount/reconnect/restart: old explosions must not play again.
    if (!old || next.time < old.time || next.tick < old.tick) return [];
    const events: PresentationEvent[] = [];
    for (const b of state.balloons)
      if (!old.balloons.has(b.id))
        events.push({
          kind: "place",
          position: { x: b.x + 0.5, y: b.y + 0.5 },
        });
    for (const b of state.blasts)
      if (!old.blasts.has(b.id))
        events.push({
          kind: "explode",
          position: { x: b.cells[0].x + 0.5, y: b.cells[0].y + 0.5 },
        });
    for (const event of state.round?.events ?? [])
      if (!old.events.has(event.id))
        events.push({ kind: event.kind, position: { ...event.position } });
    for (const coordinate of old.crates)
      if (!next.crates.has(coordinate)) {
        const [x, y] = coordinate.split(",").map(Number);
        events.push({
          kind: "pickup",
          position: { x: x + 0.5, y: y + 0.5 },
          value: 0,
        });
      }
    for (const p of state.players) {
      const before = old.players.get(p.id);
      if (!before) continue;
      const position = { ...p.position };
      if (before.status !== p.status) {
        if (p.status === "trapped")
          events.push({ kind: "trap", position, team: p.team });
        if (p.status === "respawning")
          events.push({ kind: "defeat", position, team: p.team });
        if (p.status === "active" && before.status === "respawning")
          events.push({ kind: "respawn", position, team: p.team });
        if (p.status === "active" && before.status === "trapped")
          events.push({ kind: "pickup", position, team: p.team });
      }
      if (p.combo >= 2 && p.combo > before.combo)
        events.push({ kind: "combo", position, team: p.team, value: p.combo });
      if (p.score > before.score)
        events.push({
          kind: "kill",
          position,
          team: p.team,
          value: p.score - before.score,
        });
      const after = next.players.get(p.id)!;
      if (
        after.upgrades.some((value, index) => value > before.upgrades[index]) ||
        after.buffs > before.buffs
      )
        events.push({ kind: "pickup", position, team: p.team, value: 1 });
    }
    if (next.phase === "FINISHED" && old.phase !== "FINISHED")
      events.push({ kind: "finish" });
    if (
      next.warning !== old.warning &&
      next.warning !== "normal" &&
      next.phase !== "FINISHED"
    )
      events.push({ kind: "warning" });
    return events;
  }
}
