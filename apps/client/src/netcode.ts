import {
  GAME_CONFIG as C,
  movePlayer,
  canOccupy,
  type PracticeState,
  type LocalInput,
  type NetworkInput,
  type RoomView,
} from "@bubble/shared";

const actionKeys = ["balloon", "useItem"] as const;
/** Releases must arrive too, otherwise a subsequent press can remain latched on the server. */
export function hasActionTransition(current: LocalInput, previous: LocalInput) {
  return actionKeys.some(
    (key) => Boolean(current[key]) !== Boolean(previous[key]),
  );
}

/** Client-side movement only. Scores, items, monsters and balloons always come from snapshots. */
export class OnlineTimeline {
  view: RoomView | null = null;
  private samples: {
    at: number;
    game: PracticeState;
    monsters: Map<number, { x: number; y: number }>;
  }[] = [];
  private pending: { packet: NetworkInput; dt: number }[] = [];
  private predicted: PracticeState | null = null;
  private sequence = 0;
  private elapsed = 0;
  private itemEdges: boolean[] = [];
  private lastItemInput = false;
  private actionLatch = {
    balloon: false,
    useItem: false,
  };
  private visual: { x: number; y: number } | null = null;
  constructor(
    readonly playerId: string,
    private send: (packet: NetworkInput) => void,
    private now: () => number = () => performance.now(),
  ) {}
  resetConnection() {
    this.sequence = 0;
    this.pending = [];
    this.actionLatch = {
      balloon: false,
      useItem: false,
    };
    this.elapsed = 0;
    this.itemEdges = [];
    this.lastItemInput = false;
    this.predicted = null;
    this.visual = null;
    this.samples = [];
  }
  receive(view: RoomView) {
    if (this.view && view.roundId < this.view.roundId) return;
    if (
      this.view &&
      view.roundId === this.view.roundId &&
      view.tick < this.view.tick
    )
      return;
    if (view.roundId !== this.view?.roundId) this.resetConnection();
    this.view = view;
    if (!view.game) return;
    this.samples.push({
      at: this.now(),
      game: view.game,
      monsters: new Map(
        view.game.round?.monsters.map((m) => [m.id, m.position]),
      ),
    });
    this.samples = this.samples.slice(-10);
    const ack = view.players.find((p) => p.id === this.playerId)?.ack ?? 0;
    this.pending = this.pending.filter((frame) => frame.packet.sequence > ack);
    // movePlayer only writes the predicted player's position, facing and moving flag.
    // Share read-only map/entities rather than copying the whole arena every snapshot.
    this.predicted = {
      ...view.game,
      players: view.game.players.map((p) => ({
        ...p,
        position: { ...p.position },
      })),
    };
    if (view.phase === "PLAYING" && !view.paused)
      for (const frame of this.pending) this.predict(frame.packet, frame.dt);
    else {
      this.pending = [];
      this.visual = null;
    }
  }
  private predict(input: LocalInput, dt: number) {
    const s = this.predicted,
      p = s?.players.find((p) => p.id === this.playerId);
    if (!s || !p || p.status === "respawning") return;
    for (let left = dt; left > 1e-6; left -= C.fixedStepMs)
      movePlayer(s, p, input, Math.min(C.fixedStepMs, left), false);
  }
  frame(
    input: LocalInput,
    delta: number,
    connected: boolean,
  ): PracticeState | null {
    const view = this.view;
    if (!view?.game) return null;
    const current = view.game;
    if (!this.samples.length)
      return {
        ...current,
        players: current.players.map((p) => ({ ...p, moving: false })),
      };
    const combined = input;
    for (const key of ["balloon", "useItem"] as const) {
      this.actionLatch[key] ||= combined[key]!;
    }
    const running = connected && view.phase === "PLAYING" && !view.paused;
    if (running) {
      if (Boolean(combined.useItem) !== this.lastItemInput) {
        if (this.itemEdges.length < C.maxPendingInputs)
          this.itemEdges.push(Boolean(combined.useItem));
        this.lastItemInput = Boolean(combined.useItem);
      }
      this.elapsed += Math.min(delta, C.maxFrameMs);
      const dt = 1000 / C.simulationHz;
      while (this.elapsed + 1e-7 >= dt) {
        this.elapsed = Math.max(0, this.elapsed - dt);
        const packet: NetworkInput = {
          ...combined,
          useItem: Boolean(combined.useItem),
          roundId: view.roundId,
          sequence: ++this.sequence,
        };
        for (const key of ["balloon", "useItem"] as const)
          packet[key] = Boolean(combined[key] || this.actionLatch[key]);
        // Preserve a release between quick Ctrl presses even when rendering is faster than sending.
        packet.useItem = this.itemEdges.shift() ?? Boolean(combined.useItem);
        this.actionLatch = {
          balloon: false,
          useItem: false,
        };
        this.send(packet);
        this.pending.push({ packet, dt });
        this.pending = this.pending.slice(-C.maxPendingInputs);
        this.predict(packet, dt);
      }
    } else {
      this.elapsed = 0;
      this.itemEdges = [];
      this.lastItemInput = false;
      this.actionLatch = {
        balloon: false,
        useItem: false,
      };
    }
    const target = this.now() - C.interpolationMs;
    let a = this.samples[0],
      b = this.samples.at(-1)!;
    for (const sample of this.samples) {
      if (sample.at <= target) a = sample;
      if (sample.at >= target) {
        b = sample;
        break;
      }
    }
    const alpha =
      a && b.at > a.at
        ? Math.max(0, Math.min(1, (target - a.at) / (b.at - a.at)))
        : 1;
    const mix = (
      old: { x: number; y: number } | undefined,
      pos: { x: number; y: number },
    ) =>
      old
        ? {
            x: old.x + (pos.x - old.x) * alpha,
            y: old.y + (pos.y - old.y) * alpha,
          }
        : { ...pos };
    const players = current.players.map((p) => {
      if (p.id !== this.playerId) {
        const old = a?.game.players.find((v) => v.id === p.id),
          next = b.game.players.find((v) => v.id === p.id);
        const interpolated =
          old?.status === p.status && next
            ? mix(old.position, next.position)
            : { ...p.position };
        return {
          ...p,
          position:
            current.arenaId &&
            !canOccupy(current, p, interpolated.x, interpolated.y)
              ? { ...p.position }
              : interpolated,
        };
      }
      const position = running
        ? (this.predicted?.players.find((v) => v.id === p.id)?.position ??
          p.position)
        : p.position;
      if (
        !this.visual ||
        Math.hypot(this.visual.x - position.x, this.visual.y - position.y) > 2
      )
        this.visual = { ...position };
      const factor =
        1 - Math.exp(-Math.min(delta, C.maxFrameMs) / C.correctionMs);
      this.visual = {
        x: this.visual.x + (position.x - this.visual.x) * factor,
        y: this.visual.y + (position.y - this.visual.y) * factor,
      };
      // Smoothing a turn can cut diagonally through a crate even when both
      // authoritative endpoints are valid. Never display that invalid shortcut.
      if (
        current.arenaId &&
        !canOccupy(current, p, this.visual.x, this.visual.y) &&
        canOccupy(current, p, position.x, position.y)
      )
        this.visual = { ...position };
      return {
        ...p,
        position: { ...this.visual },
        moving: running
          ? Boolean(this.predicted?.players.find((v) => v.id === p.id)?.moving)
          : false,
      };
    });
    return {
      ...current,
      players,
      round: current.round
        ? {
            ...current.round,
            monsters: current.round.monsters.map((m) => ({
              ...m,
              position: mix(
                a?.monsters.get(m.id),
                b.monsters.get(m.id) ?? m.position,
              ),
            })),
          }
        : undefined,
    };
  }
}
