import { randomBytes, randomInt } from "node:crypto";
import {
  GAME_CONFIG as C,
  createCompetition,
  stepPractice,
  EMPTY_INPUT,
  type LocalInput,
  type NetworkInput,
  type RoomView,
  type RoomPhase,
  type PracticeState,
  type RoomMember,
  type AdmissionResult,
  type ActionResult,
} from "@bubble/shared";

interface Seat {
  id: string;
  token: string;
  nickname: string;
  socketId: string | null;
  ready: boolean;
  until: number | null;
  input: LocalInput;
  actions: LocalInput;
  sequence: number;
  ack: number;
  lastInputAt: number;
  inputWindow: number;
  inputCount: number;
}
interface Room {
  code: string;
  phase: RoomPhase;
  roundId: number;
  tick: number;
  durationMs: number;
  seats: Seat[];
  game: PracticeState | null;
  countdown: number | null;
  emptySince: number | null;
  lastAdvance: number;
  reason: string | null;
}
const idle = (): LocalInput => ({
  ...EMPTY_INPUT,
  needle: false,
  shield: false,
  power: false,
});
const actions = ["balloon", "needle", "shield", "power"] as const;
const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const nickname = (value: unknown) =>
  typeof value === "string" && /^[\p{L}\p{N} _-]{1,16}$/u.test(value.trim())
    ? value.trim()
    : null;
const code = (value: unknown) =>
  typeof value === "string" && /^[A-HJ-NP-Z2-9]{8}$/.test(value.toUpperCase())
    ? value.toUpperCase()
    : null;

/** Owns all membership and simulation state; no client-provided game state is accepted. */
export class RoomService {
  readonly rooms = new Map<string, Room>();
  private bindings = new Map<string, { room: Room; seat: Seat }>();
  private sessions = new Map<string, { room: Room; seat: Seat }>();
  private limits = new Map<string, { start: number; count: number }>();
  constructor(private now: () => number = Date.now) {}
  private limited(ip: string) {
    const now = this.now();
    let bucket = this.limits.get(ip);
    if (!bucket || now - bucket.start >= 60_000) {
      bucket = { start: now, count: 0 };
      this.limits.set(ip, bucket);
    }
    return ++bucket.count > 60;
  }
  private newCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let value = "";
    do {
      value = Array.from(
        { length: 8 },
        () => chars[randomInt(chars.length)],
      ).join("");
    } while (this.rooms.has(value));
    return value;
  }
  private seat(room: Room, socketId: string, name: string) {
    const seat: Seat = {
      id: room.seats.some((s) => s.id === "p1") ? "p2" : "p1",
      token: randomBytes(32).toString("hex"),
      nickname: name,
      socketId,
      ready: false,
      until: null,
      input: idle(),
      actions: idle(),
      sequence: 0,
      ack: 0,
      lastInputAt: this.now(),
      inputWindow: 0,
      inputCount: 0,
    };
    room.seats.push(seat);
    room.emptySince = null;
    this.bindings.set(socketId, { room, seat });
    this.sessions.set(seat.token, { room, seat });
    return seat;
  }
  create(socketId: string, ip: string, request: unknown): AdmissionResult {
    if (this.limited(ip))
      return fail("요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
    if (this.bindings.has(socketId))
      return fail("현재 방에서 먼저 나가 주세요.");
    if (!record(request)) return fail("잘못된 방 생성 요청입니다.");
    const name = nickname(request.nickname);
    if (!name) return fail("닉네임은 문자·숫자·공백·_-로 1~16자 입력하세요.");
    if (request.durationMs !== 30_000 && request.durationMs !== C.roundMs)
      return fail("지원하지 않는 경기 시간입니다.");
    if (this.rooms.size >= C.maxRooms)
      return fail("서버의 방이 가득 찼습니다.");
    const room: Room = {
      code: this.newCode(),
      phase: "WAITING",
      roundId: 0,
      tick: 0,
      durationMs: request.durationMs,
      seats: [],
      game: null,
      countdown: null,
      emptySince: null,
      lastAdvance: this.now(),
      reason: null,
    };
    this.rooms.set(room.code, room);
    const seat = this.seat(room, socketId, name);
    return {
      ok: true,
      token: seat.token,
      playerId: seat.id,
      room: this.view(room),
    };
  }
  join(socketId: string, ip: string, request: unknown): AdmissionResult {
    if (this.limited(ip))
      return fail("입장 요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
    if (this.bindings.has(socketId))
      return fail("현재 방에서 먼저 나가 주세요.");
    if (!record(request)) return fail("잘못된 입장 요청입니다.");
    const name = nickname(request.nickname),
      key = code(request.code);
    if (!name || !key) return fail("닉네임과 8자리 방 코드를 확인하세요.");
    const room = this.rooms.get(key);
    if (!room) return fail("방을 찾을 수 없습니다.");
    if (room.seats.length >= C.maxPlayers)
      return fail("방이 가득 찼습니다. 최대 2명이며 재접속 자리도 예약됩니다.");
    if (room.phase === "PLAYING" || room.phase === "COUNTDOWN")
      return fail("경기가 이미 진행 중입니다.");
    if (room.phase === "FINISHED") {
      room.game = null;
      room.seats.forEach((s) => (s.ready = false));
      room.reason = null;
    }
    const seat = this.seat(room, socketId, name);
    room.phase = "WAITING";
    return {
      ok: true,
      token: seat.token,
      playerId: seat.id,
      room: this.view(room),
    };
  }
  resume(socketId: string, ip: string, request: unknown): AdmissionResult {
    if (this.limited(ip)) return fail("재접속 요청이 너무 많습니다.");
    if (this.bindings.has(socketId))
      return fail("이미 방에 연결되어 있습니다.");
    if (
      !record(request) ||
      typeof request.token !== "string" ||
      !/^[a-f0-9]{64}$/.test(request.token)
    )
      return fail("유효하지 않은 재접속 정보입니다.");
    const session = this.sessions.get(request.token);
    if (
      !session ||
      session.seat.socketId ||
      session.seat.until === null ||
      session.seat.until <= this.now()
    )
      return fail(
        "재접속 기간이 만료되었거나 다른 창에서 이미 연결되어 있습니다.",
      );
    const { room, seat } = session;
    seat.socketId = socketId;
    seat.until = null;
    seat.input = idle();
    seat.actions = idle();
    seat.sequence = seat.ack = 0;
    this.bindings.set(socketId, session);
    room.lastAdvance = this.now();
    return {
      ok: true,
      token: seat.token,
      playerId: seat.id,
      room: this.view(room),
    };
  }
  ready(socketId: string, value: unknown): ActionResult {
    if (this.limited(`socket:${socketId}`))
      return fail("준비 요청이 너무 많습니다. 잠시 기다려 주세요.");
    const binding = this.bindings.get(socketId);
    if (!binding || typeof value !== "boolean")
      return fail("방 상태를 확인하세요.");
    const { room, seat } = binding;
    if (room.phase === "PLAYING" || room.phase === "COUNTDOWN")
      return fail("진행 중에는 준비 상태를 바꿀 수 없습니다.");
    if (room.seats.length !== 2 || room.seats.some((s) => !s.socketId))
      return fail("두 사람이 연결되어야 준비할 수 있습니다.");
    seat.ready = value;
    room.reason = null;
    room.phase = room.seats.some((s) => s.ready) ? "READY" : "WAITING";
    if (room.seats.every((s) => s.ready)) {
      room.phase = "COUNTDOWN";
      room.countdown = this.now() + C.countdownMs;
    }
    return { ok: true };
  }
  input(socketId: string, packet: unknown): boolean {
    const binding = this.bindings.get(socketId);
    if (!binding) return false;
    const { room, seat } = binding,
      now = this.now();
    if (now - seat.inputWindow >= 1000) {
      seat.inputWindow = now;
      seat.inputCount = 0;
    }
    if (
      ++seat.inputCount > 90 ||
      room.phase !== "PLAYING" ||
      room.seats.some((s) => !s.socketId)
    )
      return false;
    if (
      !record(packet) ||
      packet.roundId !== room.roundId ||
      !Number.isSafeInteger(packet.sequence) ||
      Number(packet.sequence) <= seat.sequence ||
      Number(packet.sequence) > seat.sequence + 10_000
    )
      return false;
    if (
      ![-1, 0, 1].includes(Number(packet.x)) ||
      typeof packet.x !== "number" ||
      ![-1, 0, 1].includes(Number(packet.y)) ||
      typeof packet.y !== "number"
    )
      return false;
    if (actions.some((key) => typeof packet[key] !== "boolean")) return false;
    const input = packet as unknown as NetworkInput;
    for (const key of actions)
      if (input[key] && !seat.input[key]) seat.actions[key] = true;
    seat.input = {
      x: input.x,
      y: input.y,
      balloon: input.balloon,
      needle: input.needle,
      shield: input.shield,
      power: input.power,
    };
    seat.sequence = input.sequence;
    seat.lastInputAt = now;
    return true;
  }
  disconnect(socketId: string) {
    const binding = this.bindings.get(socketId);
    if (!binding) return;
    const { room, seat } = binding;
    this.bindings.delete(socketId);
    seat.socketId = null;
    seat.until = this.now() + C.reconnectGraceMs;
    seat.ready = false;
    seat.input = idle();
    seat.actions = idle();
    for (const other of room.seats) {
      other.input = idle();
      other.actions = idle();
    }
    room.game?.players.forEach((p) => (p.moving = false));
    if (room.phase === "COUNTDOWN" || room.phase === "READY") {
      room.phase = "WAITING";
      room.countdown = null;
      room.seats.forEach((s) => (s.ready = false));
    }
  }
  leave(socketId: string): ActionResult {
    const binding = this.bindings.get(socketId);
    if (!binding) return { ok: true };
    this.remove(
      binding.room,
      binding.seat,
      "상대가 방을 나가 기권 처리되었습니다.",
    );
    return { ok: true };
  }
  private remove(room: Room, seat: Seat, reason: string) {
    if (seat.socketId) this.bindings.delete(seat.socketId);
    this.sessions.delete(seat.token);
    room.seats = room.seats.filter((s) => s !== seat);
    if (room.phase === "PLAYING" && room.game?.round) {
      room.phase = "FINISHED";
      room.game.round.phase = "FINISHED";
      room.game.round.winner = seat.id === "p1" ? "green" : "red";
      room.reason = reason;
    } else if (room.phase !== "FINISHED") {
      room.phase = "WAITING";
      room.countdown = null;
      room.seats.forEach((s) => (s.ready = false));
    }
    if (!room.seats.length) room.emptySince = this.now();
  }
  advance() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      for (const seat of [...room.seats])
        if (!seat.socketId && seat.until !== null && seat.until <= now)
          this.remove(
            room,
            seat,
            "재접속 유예 시간이 지나 기권 처리되었습니다.",
          );
      if (
        room.emptySince !== null &&
        now - room.emptySince >= C.emptyRoomTtlMs
      ) {
        this.rooms.delete(room.code);
        continue;
      }
      const elapsed = Math.max(
        0,
        Math.min(C.maxFrameMs, now - room.lastAdvance),
      );
      room.lastAdvance = now;
      if (
        room.phase === "COUNTDOWN" &&
        room.countdown !== null &&
        now >= room.countdown
      ) {
        room.roundId++;
        room.tick = 0;
        room.game = createCompetition(randomInt(0x7fffffff), room.durationMs);
        room.phase = "PLAYING";
        room.countdown = null;
        for (const seat of room.seats) {
          seat.ready = false;
          seat.input = idle();
          seat.actions = idle();
          seat.sequence = seat.ack = 0;
        }
        continue;
      }
      if (
        room.phase !== "PLAYING" ||
        !room.game ||
        room.seats.some((s) => !s.socketId)
      )
        continue;
      const inputs = [idle(), idle()];
      for (const seat of room.seats) {
        if (now - seat.lastInputAt > C.inputTimeoutMs) {
          seat.input = idle();
          seat.actions = idle();
        }
        const input = { ...seat.input };
        for (const key of actions)
          input[key] = Boolean(input[key] || seat.actions[key]);
        const player = room.game.players[seat.id === "p1" ? 0 : 1];
        // A release and a fresh press may both arrive between scheduler ticks.
        // Preserve the validated rising edge without auto-repeating held buttons.
        if (seat.actions.balloon) player.bombDown = false;
        for (const key of ["needle", "shield", "power"] as const)
          if (seat.actions[key]) player.itemDown[key] = false;
        inputs[seat.id === "p1" ? 0 : 1] = input;
        seat.ack = seat.sequence;
        seat.actions = idle();
      }
      stepPractice(room.game, inputs, elapsed);
      room.tick++;
      if (room.game.round?.phase === "FINISHED") {
        room.phase = "FINISHED";
        room.seats.forEach((s) => (s.ready = false));
      }
    }
    for (const [ip, bucket] of this.limits)
      if (now - bucket.start > 60_000) this.limits.delete(ip);
  }
  view(room: Room): RoomView {
    const players: RoomMember[] = room.seats.map((s) => ({
      id: s.id,
      nickname: s.nickname,
      team: s.id === "p1" ? "red" : "green",
      connected: !!s.socketId,
      ready: s.ready,
      reconnectUntil: s.until,
      ack: s.ack,
    }));
    return {
      code: room.code,
      phase: room.phase,
      roundId: room.roundId,
      tick: room.tick,
      serverTime: this.now(),
      countdownEndsAt: room.countdown,
      paused: room.phase === "PLAYING" && room.seats.some((s) => !s.socketId),
      reason: room.reason,
      players,
      game: room.game,
    };
  }
  current(socketId: string) {
    const binding = this.bindings.get(socketId);
    return binding ? this.view(binding.room) : null;
  }
  broadcasts() {
    return [...this.bindings].map(([socketId, { room }]) => ({
      socketId,
      view: this.view(room),
    }));
  }
}
