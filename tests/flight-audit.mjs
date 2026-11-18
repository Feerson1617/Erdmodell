// Compare built directories, including historical builds that only expose geoObservatory().
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, extname, join, sep } from "node:path";
import { tmpdir, cpus } from "node:os";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const root = resolve(process.argv[2] ?? "dist"),
  out = resolve(process.argv[3] ?? "test-results/audit");
await mkdir(out, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const p = resolve(
      root,
      "." +
        new URL(req.url, "http://localhost").pathname.replace(
          /\/$/,
          "/index.html",
        ),
    );
    if (!p.startsWith(root + sep)) throw Error();
    res.setHeader(
      "content-type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
      }[extname(p)] ?? "application/octet-stream",
    );
    res.end(await readFile(p));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const system = await browser.newBrowserCDPSession();
const gpuCpu = async () =>
  (await system.send("SystemInfo.getProcessInfo")).processInfo
    .filter((p) => p.type.toLowerCase() === "gpu")
    .reduce((s, p) => s + p.cpuTime, 0);
const meta = await system.send("SystemInfo.getInfo");
const report = {
  cpu: cpus()[0].model,
  browser: browser.version(),
  renderer: meta.gpu.auxAttributes.glRenderer,
  viewport: [1366, 768],
  runs: [],
};
const percentile = (xs, p) =>
  [...xs].sort((a, b) => a - b)[
    Math.min(xs.length - 1, Math.floor(xs.length * p))
  ];
try {
  for (const style of ["A", "B"]) {
    for (let trial = 0; trial < Number(process.env.TRIALS ?? 3); trial++) {
      const page = await browser.newPage({
        viewport: { width: 1366, height: 768 },
      });
      await page.goto("http://127.0.0.1:" + server.address().port);
      await page.waitForFunction(() => window.geoObservatory?.().frames >= 3);
      if (style === "B") await page.click("#designB");
      await page.waitForTimeout(2000);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Performance.enable");
      const metric = async () =>
        Object.fromEntries(
          (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
            m.name,
            m.value,
          ]),
        );
      const cpu = await metric(),
        gpu = await gpuCpu();
      const result = await page.evaluate(async () => {
        const samples = [],
          longTasks = [];
        const observer = new PerformanceObserver((list) =>
          longTasks.push(
            ...list
              .getEntries()
              .map((e) => ({ start: e.startTime, duration: e.duration })),
          ),
        );
        observer.observe({ type: "longtask" });
        const start = performance.now();
        document.querySelector("#visit").click();
        await new Promise((done, reject) => {
          function step() {
            const t = performance.now() - start,
              w = window.geoObservatory();
            samples.push({
              t,
              d: w.d,
              triangles: w.triangles,
              draws: w.draws,
              ratio: w.pixelRatio,
              tiles: w.tiles,
              geometries: w.geometries,
              textures: w.textures,
              renderMs: w.renderMs,
              terrainMs: w.terrainMs,
            });
            if (!w.flying && w.localVisible && w.d < 0.31) done();
            else if (t > 35000) reject(Error("Anflug unvollständig"));
            else requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        });
        observer.disconnect();
        return { samples, longTasks };
      });
      const cpuEnd = await metric(),
        gpuEnd = await gpuCpu();
      const site = await page.evaluate(async () => {
        const a = window.geoObservatory(),
          start = performance.now();
        await new Promise((r) => setTimeout(r, 3000));
        const b = window.geoObservatory();
        return {
          ...b,
          fps: ((b.frames - a.frames) * 1000) / (performance.now() - start),
        };
      });
      const { samples } = result,
        span = samples.at(-1).t,
        delta = samples.map((s, i) => s.t - (samples[i - 1]?.t ?? 0));
      report.runs.push({
        style,
        trial,
        flightFps: (samples.length * 1000) / span,
        p95Ms: percentile(delta, 0.95),
        maxGapMs: Math.max(...delta),
        pauses250: delta.filter((t) => t > 250).length,
        rendererTaskMs: (cpuEnd.TaskDuration - cpu.TaskDuration) * 1000,
        gpuProcessCpuMs: (gpuEnd - gpu) * 1000,
        longTasks: result.longTasks,
        site,
        samples,
      });
      await page.close();
    }
    if (process.env.VIDEO !== "0") {
      const page = await browser.newPage({
        viewport: { width: 1366, height: 768 },
      });
      await page.goto("http://127.0.0.1:" + server.address().port);
      await page.waitForFunction(() => window.geoObservatory?.().frames >= 3);
      if (style === "B") await page.click("#designB");
      const cdp = await page.context().newCDPSession(page),
        frames = [];
      cdp.on("Page.screencastFrame", (e) => {
        frames.push({ t: e.metadata.timestamp, data: e.data });
        void cdp
          .send("Page.screencastFrameAck", { sessionId: e.sessionId })
          .catch(() => {});
      });
      await page.evaluate(() => {
        window.captureStates = [];
        function sample() {
          const w = window.geoObservatory();
          window.captureStates.push({
            epoch: performance.timeOrigin + performance.now(),
            d: w.d,
            lat: w.lat,
            lon: w.lon,
            tiles: w.tiles,
            triangles: w.triangles,
            ratio: w.pixelRatio,
            local: w.localVisible,
          });
          if (window.captureStates.length < 4000) requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 85,
        everyNthFrame: 1,
      });
      await page.waitForTimeout(350);
      await page.click("#visit");
      await page.waitForFunction(
        () =>
          !window.geoObservatory().flying &&
          window.geoObservatory().localVisible,
      );
      await page.waitForTimeout(700);
      await cdp.send("Page.stopScreencast");
      const paired = await page.evaluate(() => window.captureStates);
      await writeFile(
        join(out, "aufnahme-" + style + ".json"),
        JSON.stringify(
          paired.map(({ epoch, ...sample }) => ({
            t: Math.round(epoch - frames[0].t * 1000),
            ...sample,
          })),
        ),
      );
      assert.ok(frames.length > 10);
      const temp = await mkdtemp(join(tmpdir(), "geo-frames-"));
      try {
        const entries = [];
        for (let i = 0; i < frames.length; i++) {
          await writeFile(
            join(temp, i + ".jpg"),
            Buffer.from(frames[i].data, "base64"),
          );
          entries.push(
            "file '" + i + ".jpg'",
            "duration " +
              Math.max(
                0.001,
                (frames[i + 1]?.t ?? frames[i].t + 0.08) - frames[i].t,
              ),
          );
        }
        entries.push("file '" + (frames.length - 1) + ".jpg'");
        await writeFile(join(temp, "frames.txt"), entries.join("\n"));
        execFileSync("ffmpeg", [
          "-v",
          "error",
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          join(temp, "frames.txt"),
          "-vf",
          "fps=25,format=yuv420p",
          "-c:v",
          "libx264",
          "-threads",
          "2",
          "-crf",
          "23",
          "-movflags",
          "+faststart",
          join(out, "flug-" + style + ".mp4"),
        ]);
        await writeFile(
          join(out, "bildzeiten-" + style + ".json"),
          JSON.stringify(
            frames.map((f) => Math.round((f.t - frames[0].t) * 1000)),
          ),
        );
      } finally {
        await rm(temp, { recursive: true, force: true });
      }
      await page.close();
    }
  }
} finally {
  await writeFile(join(out, "profil.json"), JSON.stringify(report));
  await browser.close();
  server.close();
}
