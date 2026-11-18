import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
const tmp = await mkdtemp(join(tmpdir(), "GeoRisiko Pakete "));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

async function checkLocalStart(folder) {
  // Finder launches the starter from an arbitrary working directory.
  const child = spawn(join(folder, "START.command"), [], {
    cwd: tmp,
    env: { ...process.env, BROWSER: "true" },
    stdio: ["ignore", "pipe", "ignore"],
  });
  const stopped = once(child, "exit");
  const lines = createInterface({ input: child.stdout });
  try {
    const [message] = await once(lines, "line", { signal: AbortSignal.timeout(15000) });
    const address = /http:\/\/127\.0\.0\.1:\d+\//.exec(message)?.[0];
    assert.ok(address, "Starter gibt die lokale Adresse aus");
    const page = await browser.newPage({ reducedMotion: "reduce" });
    await page.goto(address);
    await page.waitForFunction(() => window.geoObservatory?.().draws > 0);
    assert.ok(await page.locator("#file-start").isHidden());
    await page.click("#nav-inside");
    assert.match(await page.locator("[data-layer]").first().innerText(), /Schale 1/);
    await page.close();
  } finally {
    lines.close();
    child.kill();
    await stopped;
  }
}

async function checkFileHint(folder) {
  const engine = await webkit.launch({ executablePath: process.env.WEBKIT_PATH || undefined });
  try {
    const page = await engine.newPage();
    await page.goto(pathToFileURL(join(folder, "index.html")).href);
    const hint = page.locator("#file-start");
    assert.ok(await hint.isVisible());
    assert.match(await hint.innerText(), /START\.command/);
    assert.match(await hint.innerText(), /python3 start_lokal\.py/);
  } finally {
    await engine.close();
  }
}

try {
  for (const name of ["SCORM-1.2", "Unterricht", "Sichtpruefung"]) {
    const path = join(tmp, name);
    execFileSync("python3", ["-c", `
from pathlib import Path
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    archive.extractall(sys.argv[2])
    if "START.command" in archive.namelist():
        mode = archive.getinfo("START.command").external_attr >> 16
        assert mode & 0o111
        (Path(sys.argv[2]) / "START.command").chmod(mode & 0o777)
`, "artifacts/GeoRisiko-G2.1-" + name + ".zip", path]);
    if (name === "Unterricht") {
      await checkFileHint(path);
      await checkLocalStart(path);
    }
    const server = createServer(async (req, res) => {
      try {
        const f = new URL(req.url, "http://localhost").pathname;
        if (f === "/host") {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Permissions-Policy", "fullscreen=()");
          res.end(
            '<script>window.calls=[];window.API={LMSInitialize(){calls.push("initialize");return "true"},LMSFinish(){calls.push("finish");return "true"},LMSSetValue(){calls.push("write");return "true"},LMSCommit(){calls.push("commit");return "true"}}</script><iframe src="/lms/kurse/erde/index.html" width="1024" height="768"></iframe>',
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
      page.on("request", (r) => {
        if (!r.url().startsWith("http://127.0.0.1:")) failures.push(r.url());
      });
      page.on("response", (r) => {
        if (r.status() >= 400) failures.push(r.url());
      });
      await page.goto("http://127.0.0.1:" + server.address().port + "/host");
      const frame = page.frames()[1];
      await frame.waitForFunction(() => window.geoObservatory?.().draws > 0);
      assert.ok(await frame.locator("#file-start").isHidden());
      await frame.locator("#nav-inside").click();
      await frame.waitForFunction(
        () => window.geoObservatory().mode === "inside",
      );
      await frame.click("#present");
      assert.equal(await frame.locator("#present").getAttribute("aria-pressed"), "true");
      assert.equal(
        await frame.evaluate(() => !!document.fullscreenElement),
        false,
      );
      await frame.click("#labels");
      await frame.click("[data-layer='2']");
      assert.match(await frame.locator("#layerText").innerText(), /flüssiges Metall/);
      await frame.click("#evidence");
      assert.match(
        await frame.locator("#content").innerText(),
        /vieler Erdbeben/,
      );
      await frame.click("#closeDialog");
      await frame.click("#present");
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
      await frame.click("#nav-plates");
      await frame.selectOption("#tectonicSite", "japan");
      await frame.waitForFunction(() => {
        const w = window.geoObservatory();
        return !w.flying && w.tectonics.site === "japan"
          && w.tectonics.processVisible && w.tectonics.reveal > 0.99;
      });
      await frame.click("#playProcess");
      await frame.waitForFunction(() => window.geoObservatory().tectonics.progress > 0);
      await frame.click("#playProcess");
      await frame.click("#resetProcess");
      assert.equal(await frame.evaluate(() => window.geoObservatory().tectonics.progress), 0);
      const persistence = await frame.evaluate(async () => ({
        local: localStorage.length,
        session: sessionStorage.length,
        cookie: document.cookie,
        databases: await indexedDB.databases(),
      }));
      assert.deepEqual(persistence, { local: 0, session: 0, cookie: "", databases: [] });
      assert.deepEqual(failures, []);
      await frame.goto("about:blank");
      assert.deepEqual(
        await page.evaluate(() => window.calls),
        name === "SCORM-1.2" ? ["initialize", "finish"] : [],
      );
      await page.close();
      console.log(name, "entpackt, Schalen, Ortsnavigation und tektonisches 3D-Modell geprüft.");
    } finally {
      server.close();
    }
  }
} finally {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
}
