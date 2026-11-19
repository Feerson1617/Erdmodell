import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { execFileSync, spawn, spawnSync } from "node:child_process";
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
    const address = /http:\/\/127\.0\.0\.1:\d+\/\?unterricht=schalenbau/.exec(message)?.[0];
    assert.ok(address, "Starter gibt die lokale Adresse aus");
    const page = await browser.newPage({ reducedMotion: "reduce" });
    await page.goto(address);
    await page.waitForFunction(() => window.geoObservatory?.().draws > 0);
    assert.ok(await page.locator("#file-start").isHidden());
    assert.deepEqual(await page.locator("nav button:visible").allTextContents(),["Globus","Schalenschnitt"]);
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

async function checkDeviceProbe(page, folder, base, shellMode) {
  await page.goto(base + "/Pruefung/geraeteprobe.html" + (shellMode ? "" : "?ansicht=nyos"));
  const model = page.frameLocator("iframe");
  await model.locator(shellMode ? "#nav-inside" : "#nav-nyos").click();
  await page.waitForFunction(shell => {
    const w = document.querySelector("iframe").contentWindow.geoObservatory?.();
    return w && !w.flying && (shell ? w.mode === "inside" && w.shell.cut : w.nyos.ready && w.mode === "nyos" && w.nyos.terrainVisible);
  },shellMode);
  if(shellMode)await model.locator("#labels").click();
  await page.locator("#sample").click();
  if (shellMode) {
    await model.locator("#earth").focus();
    await page.keyboard.press("ArrowRight");
  }
  const fileEvent = page.waitForEvent("download", { timeout: 60000 });
  await page.locator("#save").click({ timeout: 60000 });
  const file = await fileEvent;
  assert.equal(file.suggestedFilename(), shellMode ? "GeoRisiko-Schalenbau-Geraeteprobe.json" : "Nyos-Geraeteprobe.json");
  const samples = JSON.parse(await readFile(await file.path(), "utf8"));
  assert.equal(samples.length, 1);
  const [sample] = samples;
  assert.equal(sample.pruefstand, (await readFile(join(folder, "Pruefstand.txt"), "utf8")).trim());
  assert.match(sample.pruefstand, /Geprüfter Git-Commit: [a-f0-9]{40}$/);
  assert.equal(sample.start.mode, shellMode ? "inside" : "nyos");
  assert.equal(sample.ende.mode, shellMode ? "inside" : "nyos");
  if (shellMode) {
    assert.ok(sample.start.namen > 0 && sample.ende.namen > 0);
    assert.notDeepEqual(sample.start.kamera,sample.ende.kamera);
    assert.ok(sample.pausenUeber250ms >= 0 && sample.maxMs >= sample.medianMs);
  }
  assert.ok(sample.dauerMs >= 8000 && sample.bilder > 0 && sample.fps > 0);
  assert.ok(sample.bildabstaendeMs.length > 0 && sample.bildabstaendeMs.every(ms => ms > 0));
  console.log("Geräteprobe im Sichtprüfungs-ZIP:", sample.bilder, "reale Bilder in", Math.round(sample.dauerMs), "ms · JSON heruntergeladen.");
}

try {
  for (const name of ["SCORM-1.2", "Freitag-Unterricht", "Sichtpruefung"]) {
    const path = join(tmp, name);
    execFileSync("python3", ["-c", `
from pathlib import Path
import sys, zipfile
from xml.etree import ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as archive:
    assert archive.testzip() is None
    names = set(archive.namelist())
    assert ("Pruefung/geraeteprobe.html" in names) == sys.argv[1].endswith("-Sichtpruefung.zip")
    if "START.command" in names:
        assert {"Offline-Bilder/01-globus.jpg", "Offline-Bilder/02-anonym.jpg", "Offline-Bilder/04-namen.jpg"} <= names
    for document in ("freitag-20-11-2026", "qualitaet-g4.2.1", "grundlagen-g4.2", "nyos-geodaten", "nyos-geowissenschaften", "nyos-design", "nyos-technik", "nyos-unterrichtsverwendung", "nyos-abnahme"):
        assert document + ".md" in names, document
    if sys.argv[1].endswith("-SCORM-1.2.zip"):
        assert "imsmanifest.xml" in names
        manifest = ET.fromstring(archive.read("imsmanifest.xml"))
        sco = manifest.find(".//{*}resource")
        assert manifest.findtext(".//{*}schemaversion") == "1.2"
        assert sco.get("{http://www.adlnet.org/xsd/adlcp_rootv1p2}scormtype") == "sco"
        assert sco.get("href") == "index.html"
        assert manifest.find(".//{*}item").get("parameters") == "?unterricht=schalenbau"
        files = {f.get("href") for f in sco.findall("{*}file")}
        assert files == {name for name in names if name != "imsmanifest.xml" and not name.endswith(".xsd")}
    archive.extractall(sys.argv[2])
    if sys.argv[1].endswith("-SCORM-1.2.zip"):
        try:
            from lxml import etree
        except ImportError:
            print("Lokale XSD-Prüfung ausgelassen (python3-lxml fehlt).")
        else:
            folder = Path(sys.argv[2])
            schema = etree.XMLSchema(etree.parse(str(folder / "adlcp_rootv1p2.xsd")))
            schema.assertValid(etree.parse(str(folder / "imsmanifest.xml")))
            print("SCORM-Manifest gegen ADL- und IMS-Schema validiert.")
    if "START.command" in archive.namelist():
        mode = archive.getinfo("START.command").external_attr >> 16
        assert mode & 0o111
        (Path(sys.argv[2]) / "START.command").chmod(mode & 0o777)
`, "artifacts/GeoRisiko-G4.2.2-" + name + ".zip", path], { stdio: "inherit" });
    if (name === "Freitag-Unterricht") {
      const noPython=await mkdtemp(join(tmp,"Ohne Python "));
      await symlink("/usr/bin/dirname",join(noPython,"dirname"));
      const missing=spawnSync(join(path,"START.command"),[],{cwd:tmp,env:{PATH:noPython},encoding:"utf8"});
      assert.equal(missing.status,1);
      assert.match(missing.stdout,/Python 3.*Offline-Bilder/);
      await checkFileHint(path);
      await checkLocalStart(path);
    }
    const server = createServer(async (req, res) => {
      try {
        const f = new URL(req.url, "http://localhost").pathname;
        if (f === "/host" || f === "/freitag-host") {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Permissions-Policy", "fullscreen=()");
          res.end(
            '<script>window.calls=[];window.API={LMSInitialize(){calls.push("initialize");return "true"},LMSFinish(){calls.push("finish");return "true"},LMSSetValue(){calls.push("write");return "true"},LMSCommit(){calls.push("commit");return "true"}}</script><iframe src="/lms/kurse/erde/index.html" width="1024" height="768"></iframe>'.replace("index.html",f === "/freitag-host" ? "index.html?unterricht=schalenbau" : "index.html"),
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
      const origin = "http://127.0.0.1:" + server.address().port;
      page.on("pageerror", (e) => failures.push(e.message));
      page.on("request", (r) => {
        const url = new URL(r.url());
        if (url.origin !== origin && url.protocol !== "data:") failures.push(r.url());
      });
      page.on("response", (r) => {
        if (r.status() >= 400) failures.push(r.url());
      });
      if(name === "SCORM-1.2") {
        await page.goto(origin+"/freitag-host");
        const friday=page.frameLocator("iframe");
        await friday.locator("#nav-inside").click();await friday.locator("#labels").click();
        assert.ok(await friday.locator("#nav-plates").isHidden());
        assert.ok(await friday.locator("#pins button").first().isVisible());
        await page.frames()[1].goto("about:blank");
        assert.deepEqual(await page.evaluate(()=>window.calls),["initialize","finish"]);
      }
      await page.goto(origin + "/host");
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
      await frame.click('[data-object="shell-2"]');
      assert.match(await frame.locator("#layerText").innerText(), /flüssigem Metall/);
      await frame.check("#scale");
      await frame.click("#lithosphere");
      assert.equal(await frame.locator("#scale").isChecked(),false);
      assert.equal(await frame.evaluate(() => window.geoObservatory().shell.lithosphere), true);
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
      assert.equal(await frame.locator("#plateSettings").getAttribute("open"),null);
      await frame.selectOption("#tectonicSite", "japan");
      await frame.waitForFunction(() => {
        const w = window.geoObservatory();
        return !w.flying && w.tectonics.site === "japan"
          && w.tectonics.processVisible && w.tectonics.reveal > 0.99;
      });
      await frame.check("#plateNames");
      await frame.locator("#platePins button").first().click();
      assert.ok(await frame.locator("#layerText").isVisible());
      await frame.click("#playProcess");
      await frame.waitForFunction(() => window.geoObservatory().tectonics.progress > 0);
      await frame.click("#playProcess");
      await frame.click("#resetProcess");
      assert.equal(await frame.evaluate(() => window.geoObservatory().tectonics.progress), 0);
      await frame.click("#nav-nyos");
      await frame.waitForFunction(() => {
        const w = window.geoObservatory();
        return w.mode === "nyos" && w.nyos.ready && w.nyos.terrainVisible
          && w.nyos.localWeight > 0.99 && !w.flying;
      });
      await frame.click("#nyos-section");
      await frame.check("#nyos-dissolved");
      await frame.waitForFunction(() => {
        const n = window.geoObservatory().nyos;
        return n.view === "section" && n.sectionVisible && n.dissolved && n.dissolvedVisible;
      });
      await frame.click("#nyos-event");
      await frame.waitForFunction(() => {
        const n = window.geoObservatory().nyos;
        return n.view === "event" && n.pipeVisible === false && n.protectionVisible === false;
      });
      await frame.click("#nyos-play");
      await frame.waitForFunction(() => window.geoObservatory().nyos.progress > 0);
      await frame.click("#nyos-reset");
      assert.equal(await frame.evaluate(() => window.geoObservatory().nyos.progress), 0);
      await frame.click("#nyos-protection");
      await frame.selectOption("#nyos-measure", "pipe");
      await frame.waitForFunction(() => {
        const n = window.geoObservatory().nyos;
        return n.view === "protection" && n.measure === "pipe" && n.pipeVisible && n.protectionVisible;
      });
      const persistence = await frame.evaluate(async () => ({
        local: localStorage.length,
        session: sessionStorage.length,
        cookie: document.cookie,
        databases: await indexedDB.databases(),
      }));
      assert.deepEqual(persistence, { local: 0, session: 0, cookie: "", databases: [] });
      await frame.goto("about:blank");
      assert.deepEqual(
        await page.evaluate(() => window.calls),
        name === "SCORM-1.2" ? ["initialize", "finish"] : [],
      );
      if (name === "Sichtpruefung")
        for(const shell of [true,false])await checkDeviceProbe(page, path, origin + "/lms/kurse/erde",shell);
      assert.deepEqual(failures, []);
      await page.close();
      console.log(name, "entpackt, Schalen, Platten, Nyos-Seeschnitt, Ereignis und Schutzmodell geprüft.");
    } finally {
      server.close();
    }
  }
} finally {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
}
