import { test, expect } from "./fixtures";
import { writeFile, mkdir } from "node:fs/promises";

test("audio starts on explicit interaction, plays game cues, respects volume/mute and persists preferences", async ({
  page,
  duel,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-audio-state",
    "locked",
  );
  await page
    .locator("#menu-audio")
    .getByRole("button", { name: "소리 켜기", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-audio-state",
    "running",
  );
  await page
    .locator("#menu-audio [data-sound-volume]")
    .evaluate((input: HTMLInputElement) => {
      input.value = "65";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await expect(page.locator("#menu-audio output")).toHaveText("65%");
  await duel(page, { navigate: false });
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator("#game-audio [data-sound-toggle]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const x = await page.locator("[data-player=p1]").getAttribute("data-x");
  await page.locator("#game-audio [data-sound-volume]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#game-audio output")).toHaveText("66%");
  await expect(page.locator("[data-player=p1]")).toHaveAttribute("data-x", x!);
  await page.locator("#game-arena").focus();
  await page.keyboard.down("Space");
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator("html").getAttribute("data-audio-cues")) ?? "{}",
        ).place ?? 0,
    )
    .toBeGreaterThan(0);
  await page.keyboard.up("Space");
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator("html").getAttribute("data-audio-cues")) ?? "{}",
        ).explode ?? 0,
      { timeout: 10000 },
    )
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator("html").getAttribute("data-audio-cues")) ?? "{}",
        ).respawn ?? 0,
      { timeout: 10000 },
    )
    .toBeGreaterThan(0);
  expect(
    Number(await page.locator("html").getAttribute("data-audio-voices")),
  ).toBeLessThanOrEqual(24);
  await page
    .locator("#game-audio")
    .getByRole("button", { name: "소리 끄기", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-audio-voices", "0");
  await page
    .getByRole("button", { name: "메뉴로 돌아가기", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("#menu-audio [data-sound-toggle]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator("#menu-audio output")).toHaveText("66%");
  expect(errors).toEqual([]);
});

test("all original cues and the full music loop produce finite, non-clipping PCM audio", async ({
  page,
}) => {
  await page.goto("/");
  const results = await page.evaluate(async () => {
    const path = "/src/audio.ts";
    const { SOUND_CUES, scheduleTone, MUSIC, musicStep } = (await import(
      path
    )) as typeof import("../apps/client/src/audio");
    const results: {
      name: string;
      peak: number;
      rms: number;
      finite: boolean;
    }[] = [];
    const measure = (buffer: AudioBuffer, name: string) => {
      const data = buffer.getChannelData(0);
      let energy = 0,
        peak = 0,
        finite = true;
      for (const sample of data) {
        energy += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
        finite &&= Number.isFinite(sample);
      }
      return { name, peak, rms: Math.sqrt(energy / data.length), finite };
    };
    for (const [cue, tones] of Object.entries(SOUND_CUES)) {
      const context = new OfflineAudioContext(2, 48_000 * 1.2, 48_000);
      for (const tone of tones)
        scheduleTone(context, context.destination, tone, 0);
      results.push(measure(await context.startRendering(), cue));
    }
    const music = new OfflineAudioContext(2, 48_000 * 10, 48_000);
    for (let i = 0; i < MUSIC.melody.length; i++)
      for (const tone of musicStep(i))
        scheduleTone(music, music.destination, tone, (i * 60) / MUSIC.bpm / 2);
    results.push(measure(await music.startRendering(), "music"));
    return results;
  });
  expect(results).toHaveLength(13);
  for (const result of results) {
    expect(result.finite, result.name).toBe(true);
    expect(result.peak, result.name).toBeGreaterThan(0.01);
    expect(result.rms, result.name).toBeGreaterThan(0.001);
    expect(result.peak, result.name).toBeLessThan(0.95);
  }
  const samples = await page.evaluate(async () => {
    const path = "/src/audio.ts";
    const { SOUND_CUES, scheduleTone, MUSIC, musicStep } = (await import(
      path
    )) as typeof import("../apps/client/src/audio");
    const context = new OfflineAudioContext(1, 22_050 * 18, 22_050),
      master = context.createGain();
    master.gain.value = 0.65;
    master.connect(context.destination);
    for (let i = 0; i < MUSIC.melody.length; i++)
      for (const tone of musicStep(i))
        scheduleTone(context, master, tone, (i * 60) / MUSIC.bpm / 2);
    const sequence = [
      ["place", 9],
      ["explode", 9.7],
      ["kill", 10.4],
      ["combo", 11],
      ["golden", 12],
      ["trap", 13.1],
      ["defeat", 13.6],
      ["respawn", 14.2],
      ["pickup", 15.3],
      ["warning", 15.8],
      ["finish", 16.4],
    ] as const;
    for (const [cue, at] of sequence)
      for (const tone of SOUND_CUES[cue])
        scheduleTone(context, master, tone, at);
    const buffer = await context.startRendering();
    return Array.from(buffer.getChannelData(0), (sample) =>
      Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
    );
  });
  const wave = Buffer.alloc(44 + samples.length * 2);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write("WAVE", 8);
  wave.write("fmt ", 12);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(22_050, 24);
  wave.writeUInt32LE(44_100, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => wave.writeInt16LE(sample, 44 + index * 2));
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/original-sound-preview.wav", wave);
});

test("unsupported audio is clearly indicated while the game remains playable", async ({
  page,
  duel,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "AudioContext", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  await expect(page.locator("#menu-audio [data-sound-toggle]")).toBeDisabled();
  await expect(page.locator("#menu-audio [data-sound-status]")).toContainText(
    "지원하지 않아요",
  );
  await duel(page, { navigate: false });
  await expect(page.locator("#game-arena")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () =>
      Number(await page.locator("[data-player=p1]").getAttribute("data-y")),
    )
    .toBeGreaterThan(2);
  await page.keyboard.up("ArrowDown");
});
