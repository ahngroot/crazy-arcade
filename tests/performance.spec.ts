import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("records rendered frame timing and releases the game canvas across repeated sessions", async ({
  page,
}, testInfo) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /꼬물이 대전/ }).click();
    await expect(page.locator("#practice-arena")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.locator("#practice-arena canvas")).toHaveCount(1);
    if (i === 0) {
      const timing = await page.evaluate(
        () =>
          new Promise<{
            frames: number;
            durationMs: number;
            fps: number;
            p95FrameMs: number;
            renderer: string;
          }>((done) => {
            const samples: number[] = [];
            let first = 0,
              last = 0;
            function frame(now: number) {
              if (!first) {
                first = now;
                last = now;
              } else {
                samples.push(now - last);
                last = now;
              }
              if (now - first < 3000) {
                requestAnimationFrame(frame);
                return;
              }
              const canvas = document.querySelector<HTMLCanvasElement>(
                "#practice-arena canvas",
              )!;
              const gl =
                canvas.getContext("webgl2") ?? canvas.getContext("webgl");
              const debug = gl?.getExtension("WEBGL_debug_renderer_info");
              const renderer = gl
                ? debug
                  ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
                  : String(gl.getParameter(gl.RENDERER))
                : "Canvas2D";
              const sorted = [...samples].sort((a, b) => a - b);
              done({
                frames: samples.length,
                durationMs: now - first,
                fps: (samples.length * 1000) / (now - first),
                p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
                renderer,
              });
            }
            requestAnimationFrame(frame);
          }),
      );
      expect(timing.frames).toBeGreaterThan(0);
      const path = testInfo.outputPath("browser-performance.json");
      await writeFile(path, JSON.stringify(timing, null, 2));
      await testInfo.attach("browser-performance.json", {
        path,
        contentType: "application/json",
      });
    }
    await page
      .getByRole("button", { name: "메뉴로 돌아가기", exact: true })
      .click();
    await expect(page.locator("#practice-arena canvas")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
