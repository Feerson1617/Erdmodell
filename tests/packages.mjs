import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const tmp = await mkdtemp(join(tmpdir(), "georisiko-paket-"));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  for (const name of ["SCORM-1.2", "Sichtpruefung"]) {
    const path = join(tmp, name);
    execFileSync("python3", [
      "-m",
      "zipfile",
      "-e",
      "artifacts/GeoRisiko-G1-" + name + ".zip",
      path,
    ]);
    const server = createServer(async (req, res) => {
      try {
        const f = new URL(req.url, "http://localhost").pathname;
        if (f === "/host") {
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<script>window.calls=[];window.API={LMSInitialize(){calls.push("initialize");return "true"},LMSFinish(){calls.push("finish");return "true"}}</script><iframe src="/lms/kurse/erde/index.html" width="1024" height="768"></iframe>',
          );
          return;
        }
        res.setHeader(
          "Content-Type",
          {
            ".js": "text/javascript",
            ".html": "text/html",
            ".css": "text/css",
            ".webp": "image/webp",
          }[extname(f)] ?? "application/octet-stream",
        );
        if (!f.startsWith("/lms/kurse/erde/") || f.includes(".."))
          throw Error();
        res.end(await readFile(join(path, f.slice("/lms/kurse/erde/".length))));
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    try {
      const page = await browser.newPage({ reducedMotion: "reduce" });
      const failures = [];
      page.on("response", (r) => {
        if (r.status() >= 400) failures.push(r.url());
      });
      await page.goto("http://127.0.0.1:" + server.address().port + "/host");
      const frame = page.frames()[1];
      await frame.waitForFunction(() => window.geoObservatory?.().draws > 0);
      await frame.locator("#nav-inside").click();
      await frame.waitForFunction(
        () => window.geoObservatory().mode === "inside",
      );
      await frame.click("#nav-place");
      await frame.waitForFunction(() => window.geoObservatory().localVisible);
      await frame.selectOption("#siteSelect", "helgoland");
      await frame.waitForFunction(() => {
        const w = window.geoObservatory();
        return (
          w.region === "helgoland" &&
          w.localVisible &&
          w.localReady &&
          !w.flying
        );
      });
      assert.deepEqual(failures, []);
      await frame.goto("about:blank");
      assert.deepEqual(
        await page.evaluate(() => window.calls),
        name === "SCORM-1.2" ? ["initialize", "finish"] : [],
      );
      await page.close();
      console.log(name, "entpackt, WebGL und Navigation geprüft.");
    } finally {
      server.close();
    }
  }
} finally {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
}
