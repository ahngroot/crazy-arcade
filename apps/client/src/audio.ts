import type { Cue, PresentationEvent } from "./presentation";

type Voice = { stop: () => void; end: number; channel: "music" | "effect" };
type Tone = {
  note: number;
  length: number;
  type?: OscillatorType;
  slide?: number;
  volume?: number;
  delay?: number;
  noise?: boolean;
};
export const SOUND_CUES: Record<Cue, Tone[]> = {
  place: [
    { note: 76, length: 0.09, slide: 64, type: "sine", volume: 0.22 },
    { note: 88, length: 0.06, delay: 0.035, volume: 0.08 },
  ],
  explode: [
    { note: 55, length: 0.22, slide: 33, type: "sine", volume: 0.4 },
    { note: 87, length: 0.14, slide: 52, type: "triangle", volume: 0.12 },
    { note: 70, length: 0.18, noise: true, volume: 0.12 },
  ],
  kill: [
    { note: 79, length: 0.09, type: "triangle", volume: 0.15 },
    { note: 86, length: 0.12, delay: 0.07, volume: 0.13 },
  ],
  combo: [
    { note: 74, length: 0.08 },
    { note: 78, length: 0.08, delay: 0.07 },
    { note: 83, length: 0.16, delay: 0.14 },
  ],
  golden: [
    { note: 86, length: 0.13 },
    { note: 90, length: 0.13, delay: 0.1 },
    { note: 93, length: 0.28, delay: 0.2 },
  ],
  pickup: [
    { note: 81, length: 0.1, volume: 0.12 },
    { note: 88, length: 0.16, delay: 0.07, volume: 0.12 },
  ],
  trap: [{ note: 76, length: 0.24, slide: 57, type: "sine", volume: 0.2 }],
  breath: [
    { note: 43, length: 0.13, slide: 58, type: "sine", volume: 0.2 },
    { note: 51, length: 0.18, slide: 35, type: "sine", volume: 0.16 },
  ],
  defeat: [
    { note: 62, length: 0.15, volume: 0.12 },
    { note: 57, length: 0.22, delay: 0.12, volume: 0.12 },
  ],
  respawn: [
    { note: 69, length: 0.1 },
    { note: 74, length: 0.1, delay: 0.09 },
    { note: 81, length: 0.18, delay: 0.18 },
  ],
  finish: [
    { note: 74, length: 0.16 },
    { note: 78, length: 0.16, delay: 0.15 },
    { note: 81, length: 0.16, delay: 0.3 },
    { note: 86, length: 0.4, delay: 0.48 },
  ],
  warning: [
    { note: 81, length: 0.08, volume: 0.12 },
    { note: 81, length: 0.08, delay: 0.17, volume: 0.12 },
  ],
};
export const MUSIC = {
  bpm: 112,
  melody: [
    74, 78, 81, 78, 76, 74, 71, 69, 71, 74, 78, 74, 73, 69, 76, 73, 74, 78, 83,
    81, 78, 76, 74, 71, 69, 73, 76, 81, 78, 76, 73, 69,
  ],
  bass: [38, 38, 43, 43, 47, 47, 45, 45],
} as const;
export function musicStep(step: number): Tone[] {
  const duration = 60 / MUSIC.bpm / 2,
    index = step % MUSIC.melody.length;
  const notes: Tone[] = [
    {
      note: MUSIC.melody[index],
      length: duration * 0.7,
      type: "sine",
      volume: 0.055,
    },
  ];
  if (step % 4 === 0)
    notes.push({
      note: MUSIC.bass[Math.floor(index / 4)],
      length: duration * 2.7,
      type: "triangle",
      volume: 0.055,
    });
  if (step % 8 === 0)
    for (const interval of MUSIC.bass[Math.floor(index / 4)] === 47
      ? [0, 3, 7]
      : [0, 4, 7])
      notes.push({
        note: MUSIC.bass[Math.floor(index / 4)] + 24 + interval,
        length: duration * 5,
        type: "sine",
        volume: 0.014,
      });
  return notes;
}
const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** The same original synthesizer runs in real-time and in OfflineAudioContext tests. */
export function scheduleTone(
  ctx: BaseAudioContext,
  destination: AudioNode,
  tone: Tone,
  at: number,
  pan = 0,
): () => void {
  const gain = ctx.createGain(),
    panner = ctx.createStereoPanner();
  const start = Math.max(ctx.currentTime, at) + (tone.delay ?? 0),
    end = start + tone.length;
  let oscillator: OscillatorNode | AudioBufferSourceNode,
    filter: BiquadFilterNode | undefined;
  if (tone.noise) {
    const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * tone.length),
        ctx.sampleRate,
      ),
      samples = buffer.getChannelData(0);
    let seed = 1769;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    oscillator = source;
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4500, start);
    filter.frequency.exponentialRampToValueAtTime(700, end);
    oscillator.connect(filter).connect(gain);
  } else {
    const source = ctx.createOscillator();
    source.type = tone.type ?? "sine";
    source.frequency.setValueAtTime(frequency(tone.note), start);
    if (tone.slide !== undefined)
      source.frequency.exponentialRampToValueAtTime(frequency(tone.slide), end);
    oscillator = source;
    oscillator.connect(gain);
  }
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(tone.volume ?? 0.13, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));
  gain.connect(panner).connect(destination);
  const disconnect = () => {
    oscillator.disconnect();
    filter?.disconnect();
    gain.disconnect();
    panner.disconnect();
  };
  oscillator.onended = disconnect;
  oscillator.start(start);
  oscillator.stop(end + 0.015);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      oscillator.stop();
    } catch {}
    disconnect();
  };
}

export class ArcadeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = false;
  private volume = 0.35;
  private active = false;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextBeat = 0;
  private voices: Voice[] = [];
  private lastCue = new Map<Cue, number>();
  private cueCounts: Partial<Record<Cue, number>> = {};
  private supported =
    typeof window !== "undefined" && typeof window.AudioContext === "function";
  private readonly key = "bubble-sound-v1";
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) ?? "null");
      if (saved) {
        this.enabled = saved.enabled === true;
        this.volume =
          typeof saved.volume === "number" && Number.isFinite(saved.volume)
            ? Math.max(0, Math.min(1, saved.volume))
            : 0.35;
      }
    } catch {}
  }
  diagnostics() {
    return {
      enabled: this.enabled,
      volume: this.volume,
      state: !this.supported
        ? "unsupported"
        : (this.context?.state ?? "locked"),
      voices: this.voices.filter(
        (v) => v.end > (this.context?.currentTime ?? 0),
      ).length,
      played: { ...this.cueCounts },
      music: this.scheduler !== null,
    };
  }
  private save() {
    try {
      localStorage.setItem(
        this.key,
        JSON.stringify({ enabled: this.enabled, volume: this.volume }),
      );
    } catch {}
  }
  async unlock() {
    if (!this.enabled || !this.supported) return;
    if (
      !this.context &&
      "userActivation" in navigator &&
      !navigator.userActivation.hasBeenActive
    ) {
      this.refresh();
      return;
    }
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        this.master.connect(this.context.destination);
        this.context.onstatechange = () => this.refresh();
      }
      if (this.context.state === "suspended") await this.context.resume();
      if (this.active && this.context.state === "running") this.startMusic();
    } catch {
      this.supported = false;
      this.stopMusic();
    }
    this.refresh();
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    this.save();
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        value ? this.volume : 0,
        this.context.currentTime,
        0.015,
      );
    if (value) void this.unlock();
    else {
      this.stopMusic();
      this.stopVoices();
    }
    this.refresh();
  }
  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    this.save();
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.enabled ? this.volume : 0,
        this.context.currentTime,
        0.015,
      );
    this.refresh();
  }
  private stopVoices(channel?: Voice["channel"]) {
    for (const voice of this.voices)
      if (!channel || voice.channel === channel) voice.stop();
    this.voices = this.voices.filter((v) => channel && v.channel !== channel);
  }
  private tone(tone: Tone, at: number, channel: Voice["channel"], pan = 0) {
    if (
      !this.context ||
      !this.master ||
      !this.enabled ||
      this.context.state !== "running"
    )
      return;
    this.voices = this.voices.filter((v) => v.end > this.context!.currentTime);
    if (this.voices.length >= 24) {
      const index = Math.max(
        0,
        this.voices.findIndex((v) => v.channel === "music"),
      );
      this.voices.splice(index, 1)[0].stop();
    }
    const stop = scheduleTone(this.context, this.master, tone, at, pan);
    this.voices.push({
      stop,
      channel,
      end:
        Math.max(at, this.context.currentTime) +
        (tone.delay ?? 0) +
        tone.length +
        0.02,
    });
  }
  play(cue: Cue, pan = 0) {
    if (
      !this.enabled ||
      !this.context ||
      this.context.state !== "running" ||
      document.hidden
    )
      return;
    const now = this.context.currentTime;
    if (now - (this.lastCue.get(cue) ?? -10) < 0.065) return;
    this.lastCue.set(cue, now);
    this.cueCounts[cue] = (this.cueCounts[cue] ?? 0) + 1;
    for (const tone of SOUND_CUES[cue]) this.tone(tone, now, "effect", pan);
    this.refresh();
  }
  events(events: PresentationEvent[]) {
    for (const event of events) {
      if (event.kind === "pickup" && event.value === 0) continue;
      this.play(
        event.kind,
        event.position ? (event.position.x / 15 - 0.5) * 1.2 : 0,
      );
    }
  }
  result() {
    this.active = false;
    this.stopMusic();
    this.refresh();
  }
  beginSession() {
    this.active = true;
    void this.unlock();
  }
  endSession() {
    this.active = false;
    this.stopMusic();
    this.stopVoices();
    this.refresh();
  }
  private startMusic() {
    if (this.scheduler || !this.context || document.hidden || !this.active)
      return;
    this.step = 0;
    this.nextBeat = this.context.currentTime + 0.04;
    const schedule = () => {
      if (!this.context || this.context.state !== "running") return;
      const duration = 60 / MUSIC.bpm / 2;
      // Timers can be throttled: never catch up minutes of queued notes.
      if (this.nextBeat < this.context.currentTime - 0.1)
        this.nextBeat = this.context.currentTime + 0.04;
      while (this.nextBeat < this.context.currentTime + 0.18) {
        for (const tone of musicStep(this.step))
          this.tone(
            tone,
            this.nextBeat,
            "music",
            tone.type === "triangle" ? -0.18 : 0.18,
          );
        this.step++;
        this.nextBeat += duration;
      }
      this.voices = this.voices.filter(
        (v) => v.end > this.context!.currentTime,
      );
      this.refresh();
    };
    this.scheduler = setInterval(schedule, 90);
    schedule();
  }
  private stopMusic() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    this.stopVoices("music");
  }
  visibility() {
    if (document.hidden) {
      this.stopMusic();
      this.stopVoices();
      if (this.context?.state === "running")
        void this.context.suspend().catch(() => {});
    } else if (this.enabled) void this.unlock();
    this.refresh();
  }
  bind() {
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "[data-sound-toggle]",
    ))
      button.addEventListener("click", () => this.setEnabled(!this.enabled));
    for (const input of document.querySelectorAll<HTMLInputElement>(
      "[data-sound-volume]",
    ))
      input.addEventListener("input", () =>
        this.setVolume(Number(input.value) / 100),
      );
    document.addEventListener("pointerdown", () => void this.unlock(), {
      capture: true,
    });
    document.addEventListener("keydown", () => void this.unlock(), {
      capture: true,
    });
    document.addEventListener("visibilitychange", () => this.visibility());
    this.refresh();
  }
  private refresh() {
    const d = this.diagnostics();
    document.documentElement.dataset.audioState = d.state;
    document.documentElement.dataset.audioVoices = String(d.voices);
    document.documentElement.dataset.audioCues = JSON.stringify(d.played);
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "[data-sound-toggle]",
    )) {
      button.setAttribute("aria-pressed", String(this.enabled));
      button.setAttribute(
        "aria-label",
        this.enabled ? "소리 끄기" : "소리 켜기",
      );
      button.disabled = !this.supported;
      button.querySelector("span")!.textContent = this.enabled
        ? "SOUND ON"
        : "SOUND OFF";
    }
    for (const input of document.querySelectorAll<HTMLInputElement>(
      "[data-sound-volume]",
    ))
      input.value = String(Math.round(this.volume * 100));
    for (const output of document.querySelectorAll<HTMLOutputElement>(
      "[data-sound-level]",
    ))
      output.value = `${Math.round(this.volume * 100)}%`;
    for (const status of document.querySelectorAll<HTMLElement>(
      "[data-sound-status]",
    ))
      status.textContent = !this.supported
        ? "이 브라우저는 소리를 지원하지 않아요"
        : !this.enabled
          ? "소리 없이 플레이"
          : d.state === "running"
            ? this.volume === 0
              ? "음량 0%"
              : this.active
                ? "오리지널 사운드 재생 중"
                : "효과음 준비됨"
            : "클릭하거나 키를 누르면 소리가 시작돼요";
  }
}
export const arcadeAudio = new ArcadeAudio();
