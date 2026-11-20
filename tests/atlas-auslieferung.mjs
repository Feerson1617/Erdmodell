// Reopen all three distributed products from a clean folder, independently of the build.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, webkit } from "playwright";

const products = resolve(process.env.ATLAS_PRODUCTS || "artifacts");
const html = "GeoRisiko-Erdmodell-G4.3.1.html";
const source = await readFile(join(products, html));
const sha = createHash("sha256").update(source).digest("hex");
assert.ok(source.equals(await readFile(join("ausgabe", html))));

const temp = await mkdtemp(join(tmpdir(), "GeoRisiko Paketprüfung "));
const isolated = join(temp, "Finder ohne Nachbardateien");
const course = join(temp, "Kurs");
const mime = {
  ".js": "text/javascript", ".css": "text/css", ".html": "text/html",
  ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2"
};

const lmsHost = `<!doctype html><script>
  window.calls = [];
  window.API = {
    LMSInitialize() { calls.push("initialize"); return "true" },
    LMSFinish() { calls.push("finish"); return "true" },
    LMSSetValue() { calls.push("write"); return "true" },
    LMSCommit() { calls.push("commit"); return "true" }
  };
</script><iframe title="Kurs" src="/kurs/index.html" width="1100" height="700"></iframe>`;

const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/lms") {
    res.setHeader("Content-Type", "text/html");
    res.end(lmsHost);
    return;
  }
  const file = resolve(course, "." + decodeURIComponent(path.slice(5)));
  if (!path.startsWith("/kurs/") || !file.startsWith(course + sep)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(file);
    res.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});

async function checkModel(ui) {
  await ui.waitForFunction(() => window.geoObservatory?.().ready);
  await ui.click("#nav-inside");
  await ui.click("#labels");
  await ui.click('[data-object="shell-3"]');
  await ui.locator(".shellQuestions button").last().click();
  assert.match(await ui.locator("#shellAnswer").innerText(), /erstarren/);
  await ui.click("#nav-plates");
  await ui.waitForFunction(() => window.geoObservatory().tectonics.ready);
  await ui.click("#atlasPlay");
  await ui.waitForFunction(() => window.geoObservatory().tectonics.mosaic.progress > .035);
  assert.equal(await ui.evaluate(() => window.geoObservatory().tectonics.mosaic.pair.step), 4209);
  await ui.click("#atlasReset");
  assert.equal(await ui.evaluate(() => window.geoObservatory().tectonics.mosaic.progress), 0);
}

async function checkProduct(browser, sco, origin) {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [], outside = [], files = [];
  try {
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.protocol === "file:") files.push(basename(url.pathname));
      if (/^https?:$/.test(url.protocol) && (!sco || url.origin !== origin)) outside.push(url.href);
    });
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) errors.push(response.url()); });
    if (!sco) await page.route(/^https?:/, route => route.abort());
    await page.goto(sco ? origin + "/lms" : pathToFileURL(join(isolated, html)).href);
    const ui = sco ? page.frames()[1] : page;
    await checkModel(ui);
    if (sco) {
      await ui.goto("about:blank");
      assert.deepEqual(await page.evaluate(() => window.calls), ["initialize", "finish"]);
    } else {
      assert.deepEqual(files, [html]);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(outside, []);
  } finally {
    await page.close();
  }
}

try {
  await mkdir(isolated);
  await copyFile(join(products, html), join(isolated, html));
  execFileSync("python3", ["-c", `
import json, sys, zipfile
from pathlib import Path
products, course, sha = sys.argv[1:]
with zipfile.ZipFile(Path(products) / "GeoRisiko-G4.3.1-Sichtpruefung.zip") as z:
    assert z.testzip() is None
    assert json.loads(z.read("pruefung.json"))["htmlSHA256"] == sha
with zipfile.ZipFile(Path(products) / "GeoRisiko-G4.3.1-SCORM-1.2.zip") as z:
    assert z.testzip() is None
    z.extractall(course)
`, products, course, sha]);
  await new Promise(ready => server.listen(0, "127.0.0.1", ready));
  const origin = "http://127.0.0.1:" + server.address().port;
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({
      executablePath: engine === webkit ? process.env.WEBKIT_PATH : undefined,
      args: engine === chromium ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []
    });
    try {
      for (const sco of [false, true]) {
        await checkProduct(browser, sco, origin);
        console.log(engine.name(), sco ? "SCORM 1.2" : "isolierter file://-Start", sha);
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
  await rm(temp, { recursive: true, force: true });
}
