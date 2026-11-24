import {plainAtlas} from "./lesson-controls.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";
import { preview } from "vite";

const dest = "test-results/g2.1";
await mkdir(dest, { recursive: true });
const server = await preview({
  configFile: false, base: "/schule/erdmodell/", build: { outDir: process.env.TEST_BUILD ?? "dist" },
  preview: { host: "127.0.0.1", port: 0 }, logLevel: "error",
});
const url = "http://127.0.0.1:" + server.httpServer.address().port + "/schule/erdmodell/";
const steps = JSON.parse(await readFile("src/tectonics/steps.json", "utf8"));
// Independent regional fixtures from the PB2002_steps table; lat/lon to 0.01 degrees.
const sites = [
  { id: "island", step: 4209, lat: 63.88, lon: -22.30, kind: "OSR", az: 103, arrows: {EU:103, NA:283}, photo: "07-island", section: "04-divergenz" },
  { id: "japan", step: 2629, lat: 38.26, lon: 143.95, kind: "SUB", az: 295, arrows: {PA:295, OK:115}, photo: "08-japan", section: "05-subduktion" },
  { id: "san", step: 2877, lat: 35.68, lon: -120.19, kind: "CTF", az: 144, arrows: {NA:144, PA:324}, photo: "09-san-andreas", section: "06-transform" },
];
const report = {
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  testedAt: new Date().toISOString(), runs: [],
};
const diagnostics = page => page.evaluate(() => window.geoObservatory());
const settled = page => page.waitForFunction(() => {
  const w = window.geoObservatory?.();
  return w?.frames > 2 && !w.flying;
});
const painted = page => page.evaluate(() => new Promise(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));
const angle = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const pose = w => [w.lat, w.lon, w.d, w.tilt, w.bearing];
const canvasImage = async page => PNG.sync.read(await page.locator("#earth").screenshot({
  // Playwright clips the composited frame. Exclude text, controls and projected DOM labels.
  style: "#sidebar,.view > :not(canvas){visibility:hidden!important}",
}));
async function boundaryCycle(page, navigation = false) {
  // Compare finished views. During the atlas reveal the cover changes independently
  // of the boundary lines. Pixel differences from that transition cannot test them.
  if (!navigation) await page.waitForFunction(() => window.geoObservatory().tectonics.mosaic?.opening === 1);
  for (let attempt=0; attempt<4; attempt++) {
    const frames = await page.evaluate(async navigation => {
      const surface=document.getElementById("earth"), image=document.createElement("canvas");
      image.width=840; image.height=Math.round(image.width*surface.clientHeight/surface.clientWidth);
      const ctx=image.getContext("2d"), captures=[];
      for (let i=0; i<3; i++) {
        if (i) {
          const control = navigation ? (i === 1 ? "nav-plates" : "nav-globe") : "boundaries";
          document.getElementById(control).click();
          if (navigation && i === 1) {
            const started = performance.now();
            while (window.geoObservatory().tectonics.mosaic?.opening !== 1) {
              if (performance.now() - started > 30000) throw Error("Plattenatlas öffnet sich nicht");
              await new Promise(requestAnimationFrame);
            }
          }
        }
        const frame=await new Promise(resolve=>requestAnimationFrame(() => {
          const w=window.geoObservatory();
          ctx.drawImage(surface,0,0,image.width,image.height);
          resolve({png:image.toDataURL(), ratio:w.pixelRatio, width:surface.width, height:surface.height,
            draws:w.draws, boundaries:w.mode === "plates" && w.tectonics.boundaries, uploadedTiles:w.uploadedTiles});
        }));
        captures.push(frame);
      }
      return captures;
    }, navigation);
    if (!frames.every(f=>f.width===frames[0].width && f.height===frames[0].height &&
        f.uploadedTiles===frames[0].uploadedTiles)) continue;
    const [off,on,hidden]=frames.map(f=>PNG.sync.read(Buffer.from(f.png.split(",")[1],"base64")));
    const added=changed(off,on), removed=changed(on,hidden), drift=changed(off,hidden);
    assert.deepEqual(frames.map(f=>f.boundaries),[false,true,false]);
    assert.ok(frames[1].draws-frames[1].uploadedTiles > frames[2].draws-frames[2].uploadedTiles,
      "Der Renderer zeichnet nach Ausblenden weiter die Grenzgeometrie");
    assert.ok(added>0.0007 && removed>0.0007 && drift<Math.min(added,removed)*0.6,
      `Sichtbarkeit im gerenderten Bild: ein ${added}, aus ${removed}, Abweichung vom Ausgangsbild ${drift}`);
    return {added,removed,drift, frames:frames.map(({png,...metrics})=>metrics)};
  }
  throw new Error("Innerhalb von vier Bildtripeln keine konstante Renderpuffergröße und Kachelzahl");
}
function changed(a, b) {
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  let count = 0, total = 0;
  for (let i = 0; i < a.data.length; i += 16) {
    const delta = [0, 1, 2].reduce((sum, c) => sum + Math.abs(a.data[i+c] - b.data[i+c]), 0);
    if (delta > 35) count++;
    total++;
  }
  return count / total;
}
function quantile(values, q) {
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.ceil(q * sorted.length)-1];
}
function attachErrors(page, errors) {
  page.on("pageerror", err => errors.push(err.message));
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("response", res => { if (res.status() >= 400) errors.push(res.status() + " " + res.url()); });
  page.on("request", req => {
    if (/^https?:/.test(req.url()) && !req.url().startsWith(url)) errors.push(req.url());
  });
}
// Project a known East African PB2002 boundary using geographic coordinates.
// This checks the globe's coordinate mapping and the actual touch hit target together.
async function pickAfricanRift(page) {
  const step = steps.find(s => s[2] === "CRB" && s[4] > -5 && s[4] < 9 && s[3] > 28 && s[3] < 40);
  assert.ok(step);
  const radians = Math.PI / 180, r = 6371;
  const lat = (step[4]+step[6])/2*radians, lon = (step[3]+step[5])/2*radians;
  const {lat:homeLat,lon:homeLon,d,tilt,bearing} = await diagnostics(page);
  assert.equal(tilt,0); assert.equal(bearing,0);
  const h = homeLat*radians, dl = lon-homeLon*radians;
  const east = Math.cos(lat)*Math.sin(dl);
  const north = Math.sin(lat)*Math.cos(h) - Math.cos(lat)*Math.sin(h)*Math.cos(dl);
  const up = Math.sin(lat)*Math.sin(h) + Math.cos(lat)*Math.cos(h)*Math.cos(dl);
  const depth = d+r*(1-up), b=await page.locator("#earth").boundingBox();
  const focal = b.height/(2*Math.tan(39*radians/2));
  await page.touchscreen.tap(b.x+b.width/2+east*r*focal/depth, b.y+b.height/2-north*r*focal/depth);
  const selected = (await diagnostics(page)).tectonics.selected;
  assert.ok(selected, "Antippen der projizierten Grabenbruchlinie hat keine Grenze ausgewählt");
  const actual = steps.find(s=>s[0]===selected);
  assert.equal(actual[2],"CRB");
  assert.ok(Math.hypot(actual[4]-lat/radians,actual[3]-lon/radians)<3);
}
async function watchFlight(page) {
  await page.evaluate(() => {
    const origin = performance.now();
    window.flightSamples = [];
    window.recordFlight = true;
    function sample(t) {
      if (!window.recordFlight) return;
      const w = window.geoObservatory(), plate = w.tectonics;
      window.flightSamples.push({
        t: Math.round(t-origin), d: w.d, lat: w.lat, lon: w.lon,
        bearing: w.bearing, tilt: w.tilt, flying: w.flying, tiles: w.tiles,
        patch: plate.patchOpacity, section: plate.processVisible, focusHeight: plate.focusHeight,
      });
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
}
async function finishFlight(page) {
  await painted(page);
  const samples = await page.evaluate(() => {
    window.recordFlight = false;
    return window.flightSamples;
  });
  const first = samples[0], last = samples.at(-1);
  assert.ok(first.d > 5000 && last.d < 150);
  assert.ok(samples.filter(s => s.flying).length >= 4, "Zu wenige reale Zwischenbilder im Flug");
  assert.ok(samples.some(s => s.d > 180 && s.d < 2400 && s.patch > 0 && !s.section), "Regionale Satellitenansicht während des Fluges fehlt");
  assert.ok(last.section, "Kein lokaler Schnitt am Flugende");
  for (let i=1; i<samples.length; i++) assert.ok(samples[i].d <= samples[i-1].d + 0.01);
  const moving = samples.filter(s => s.flying || s === last);
  const gaps = moving.slice(1).map((s,i) => s.t-moving[i].t);
  return {
    samples, frames: moving.length, ms: last.t - moving[0].t, maxGapMs: Math.max(...gaps),
    gapsOver250ms: gaps.filter(ms => ms>250).length,
    maxLogDistanceStep: Math.max(...moving.slice(1).map((s,i) => Math.abs(Math.log(s.d/moving[i].d)))),
    maxBearingStep: Math.max(...moving.slice(1).map((s,i) => angle(s.bearing,moving[i].bearing))),
  };
}
async function cadence(page) {
  const result = await page.evaluate(async () => {
    const times = [], start = performance.now();
    let last = start;
    while (last - start < 3500 || times.length < 4) {
      const next = await new Promise(requestAnimationFrame);
      if (next > last) times.push(next-last);
      last = next;
    }
    const w = window.geoObservatory();
    const gl = document.querySelector("#earth").getContext("webgl2");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return { times, resolution: w.resolution, pixelRatio: w.pixelRatio,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      geometries: w.geometries, textures: w.textures, programs: w.programs,
      heapBytes: performance.memory?.usedJSHeapSize ?? null };
  });
  const gaps = result.times;
  return { ...result, fps: 1000 * gaps.length / gaps.reduce((sum,n) => sum+n,0),
    medianMs: quantile(gaps,0.5), p95Ms: quantile(gaps,0.95), maxMs: Math.max(...gaps),
    gapsOver250ms: gaps.filter(gap => gap > 250).length };
}
async function choose(page, id) {
  await page.selectOption("#tectonicSite", id);
  await page.waitForFunction(id => {
    const w = window.geoObservatory();
    return w.tectonics.site === id && !w.flying && w.tectonics.processVisible;
  }, id);
}
async function assertNoDataConsole(page) {
  const text = await page.locator("#sidebar").innerText();
  assert.doesNotMatch(text, /Azimut|mm\s*\/\s*(a|Jahr)|UTC|Abschnitt\s*#?\d|\d+\s*°/i);
  assert.equal(await page.locator("#sidebar table:visible").count(), 0);
}
async function sampleResources(page) {
  const state = await diagnostics(page);
  return { models: state.tectonics.models, geometries: state.geometries, textures: state.textures,
    uploadedTiles: state.uploadedTiles, terrainCache: state.cachedTiles, programs: state.programs,
    heapBytes: await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null) };
}
async function exercise(browser, engine) {
  const run = { engine, version: browser.version(), checks: [], cadence: {}, resources: [], errors: [], images: [] };
  report.runs.push(run);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, hasTouch: true, deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(40000);
  attachErrors(page, run.errors);
  const pass = name => { run.checks.push(name); console.log(engine, name); };
  const snap = async name => {
    await painted(page);
    if (engine !== "chromium") return;
    const bytes = await page.screenshot({ path: join(dest, name + ".jpg"), type: "jpeg", quality: 86 });
    const hash = createHash("sha256").update(bytes).digest("hex");
    assert.ok(!run.images.some(img => img.sha256 === hash), name + " zeigt denselben Zustand");
    run.images.push({ name, sha256: hash });
  };
  try {
    await page.goto(url);
    await settled(page);
    await page.tap("#present");
    await page.waitForFunction(() => document.querySelector("#present").getAttribute("aria-pressed") === "true");
    assert.equal((await diagnostics(page)).style, "A");
    await snap("01-globus");
    const before = await diagnostics(page);
    await page.tap("#nav-plates");
    await page.waitForFunction(() => window.geoObservatory().tectonics.ready);
    assert.deepEqual(pose(await diagnostics(page)), pose(before), "Kamerapose beim Aktivieren der Ebene");
    await plainAtlas(page);assert.equal((await diagnostics(page)).tectonics.boundaries, false);
    run.boundaryFrames = await boundaryCycle(page);
    await page.tap("#boundaries");
    await painted(page);
    const on = await canvasImage(page);
    assert.equal((await diagnostics(page)).tectonics.count, 5819);
    await assertNoDataConsole(page);
    await snap("02-plattengrenzen");
    await page.tap("#plateSettings summary");
    await page.tap("#boundaryTypes");
    await painted(page);
    assert.ok(changed(on, await canvasImage(page)) > 0.0005, "Typfarben fehlen");
    for (const kind of ["divergent","convergent","transform","all"]) {
      await page.locator('#kindFilter input[value="'+kind+'"]').check();
      assert.equal((await diagnostics(page)).tectonics.category,kind);
    }
    await pickAfricanRift(page);
    await page.tap("#plateNames");
    await page.waitForFunction(() => document.querySelector("#platePins")?.innerText.includes("Platte"));
    await snap("03-plattennamen");
    await page.selectOption("#plateSelect", "AF");
    assert.equal((await diagnostics(page)).tectonics.plate,"AF");
    await painted(page);
    const chosen = await canvasImage(page);
    await page.selectOption("#plateSelect", { index: 0 });
    await painted(page);
    assert.ok(changed(chosen,await canvasImage(page))>0.003, "Gewählte Plattenfläche erscheint ohne eigene Tönung");
    await page.tap("#nav-globe");
    assert.deepEqual(pose(before),pose(await diagnostics(page)));
    run.navigationFrames = await boundaryCycle(page, true);
    assert.deepEqual(pose(await diagnostics(page)), pose(before), "Kamerapose beim Rückweg");
    await page.tap("#nav-plates");
    pass("Gemeinsamer Globus ohne Kamerasprung, Grenzen, Kategorien, Flächen und Namen");
    // First flight uses full motion. Other site visits use the real reduced-motion path.
    await watchFlight(page);
    for (const site of sites) {
      await choose(page,site.id);
      if (site.id === "island") {
        run.flight = await finishFlight(page);
        await page.emulateMedia({ reducedMotion: "reduce" });
      }
      const w = await diagnostics(page), t = w.tectonics;
      const source = steps.find(s => s[0] === site.step);
      assert.equal(t.selected,site.step);
      assert.equal(source[2],site.kind);
      assert.equal(source[8],site.az);
      assert.equal(t.model.arrows.length,2);
      for (const arrow of t.model.arrows)
        assert.ok(angle(arrow.azimuth,site.arrows[arrow.plate]) < 3, "Gerenderter Bewegungspfeil "+site.id+" "+arrow.plate);
      assert.ok(Math.abs(w.lat-site.lat)<0.05 && angle(w.lon,site.lon)<0.05, "PB2002-Anker " + site.id);
      assert.ok(t.processVisible && w.d < 150 && t.patchOpacity > 0);
      assert.ok(Math.abs(t.anchor.lat-site.lat)<0.05 && angle(t.anchor.lon,site.lon)<0.05);
      assert.ok(Number.isFinite(t.processBearing) && w.tilt > 0 && w.tilt < 90);
      await assertNoDataConsole(page);
      assert.match(await page.locator("body").innerText(), /zeit(lich)? stark überhöht/i);
      const extents = await page.locator("#earth").boundingBox();
      const panel = await page.locator("#sidebar").boundingBox();
      const coveredWidth = Math.max(0, Math.min(extents.x+extents.width,panel.x+panel.width)-Math.max(extents.x,panel.x));
      const coveredHeight = Math.max(0, Math.min(extents.y+extents.height,panel.y+panel.height)-Math.max(extents.y,panel.y));
      const freeArea = (extents.width*extents.height-coveredWidth*coveredHeight)/(1920*1080);
      run.boardArea = Math.min(run.boardArea ?? 1,freeArea);
      assert.ok(freeArea>=0.70, "Am Smartboard frei sichtbare Modellfläche");
      for (const selector of ["#playProcess","#resetProcess","#regionalOverview"]) {
        const b = await page.locator(selector).boundingBox();
        assert.ok(b && b.height>=44 && b.width>=44 && b.y>=0 && b.y+b.height<=1080, "Touchziel "+selector);
      }
      await page.tap("#resetProcess");
      assert.equal((await diagnostics(page)).tectonics.progress,0);
      const initial = await canvasImage(page);
      await page.tap("#playProcess");
      await page.waitForFunction(() => window.geoObservatory().tectonics.progress >= 0.28);
      await page.tap("#playProcess");
      const paused = (await diagnostics(page)).tectonics.progress;
      assert.ok(paused>0 && paused<1);
      await painted(page);
      assert.equal((await diagnostics(page)).tectonics.progress,paused);
      const moving = await canvasImage(page);
      assert.ok(changed(initial, moving)>0.0006, "Prozessbewegung im tatsächlichen Renderbild fehlt: "+site.id);
      await snap(site.section);
      await page.tap("#playProcess");
      run.cadence[site.id] = await cadence(page);
      await page.tap("#resetProcess");
      assert.equal((await diagnostics(page)).tectonics.playing,false);
      assert.equal((await diagnostics(page)).tectonics.progress,0);
      await page.tap("#regionalOverview");
      await settled(page);
      const regional = await diagnostics(page);
      assert.ok(regional.d > w.d * 2 && regional.tectonics.patchOpacity > 0 && !regional.tectonics.processVisible);
      await snap(site.photo);
      await page.tap("#localProcess");
      await settled(page);
      assert.ok((await diagnostics(page)).tectonics.processVisible);
    }
    pass("Drei PB2002-Anker, regionales Bild, Start/Pause/Reset und sichtbare Änderung der Prozessgeometrie");
    const preOrbit = await diagnostics(page);
    // A named process part can cover the centre of the canvas on a smartboard.
    const orbitStart = await page.locator("#earth").evaluate(canvas => {
      const rect = canvas.getBoundingClientRect();
      for (const xFraction of [.55, .38, .7, .28])
        for (const yFraction of [.55, .35, .7]) {
          const x = rect.x + xFraction * rect.width, y = rect.y + yFraction * rect.height;
          if (document.elementFromPoint(x, y) === canvas) return {x, y};
        }
      return null;
    });
    assert.ok(orbitStart, "Frei greifbare Modellfläche für die Kameradrehung");
    await page.mouse.move(orbitStart.x, orbitStart.y);
    await page.mouse.down({button:"right"});
    await page.mouse.move(orbitStart.x + 95, orbitStart.y + 42, {steps:6});
    await page.mouse.up({button:"right"});
    await page.waitForFunction(start => Math.abs(window.geoObservatory().bearing-start)>2, preOrbit.bearing);
    await page.tap("#slowProcess");
    assert.equal((await diagnostics(page)).tectonics.slow,true);
    await page.tap("#slowProcess");
    await page.tap("#resetProcess");
    await page.tap("#playProcess");
    await page.waitForFunction(() => {
      const t = window.geoObservatory().tectonics;
      return t.progress===1 && !t.playing;
    },null,{timeout:60000});
    await page.tap("#loopProcess");
    await page.tap("#playProcess");
    await page.waitForFunction(() => {
      const t = window.geoObservatory().tectonics;
      return t.progress > 0.80 && t.playing && t.loop;
    },null,{timeout:60000});
    await page.waitForFunction(() => {
      const t = window.geoObservatory().tectonics;
      return t.progress < 0.45 && t.playing && t.loop;
    },null,{timeout:45000});
    await page.tap("#resetProcess");
    pass("Blickwinkel, verlangsamte Wiedergabe, definierter Endzustand und tatsächlicher Schleifendurchlauf");
    for (let cycle=0; cycle<5; cycle++) {
      for (const site of sites) {
        await page.tap("#plateOverview");
        await settled(page);
        await choose(page,site.id);
      }
      await painted(page);
      run.resources.push(await sampleResources(page));
    }
    const warm = run.resources.slice(1), first=warm[0];
    assert.ok(warm.every(s => s.models===first.models && s.models<=3 &&
      s.programs <= first.programs+2 && s.textures <= first.textures+2 &&
      s.geometries-s.uploadedTiles <= first.geometries-first.uploadedTiles+12), "Wachstum bei warmen Wiederholungen");
    await page.tap("#nav-inside");
    await settled(page);
    assert.doesNotMatch(await page.locator("#sidebar").innerText(), /Erdkern|Erdkruste|Erdmantel/i);
    assert.equal((await diagnostics(page)).tectonics.processVisible,false);
    await snap("10-schalenschnitt");
    await page.tap("#nav-place");
    await settled(page);
    for (const id of ["hooge","helgoland","island","japan","san"])
      assert.ok(await page.locator('#siteSelect option[value="'+id+'"]').count()===1);
    await page.selectOption("#siteSelect","japan");
    await settled(page);
    assert.equal((await diagnostics(page)).tectonics.site,"japan");
    await page.tap("#present");
    await page.setViewportSize({width:768,height:1024});
    await page.tap("#playProcess");
    await page.tap("#playProcess");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(run.errors,[]);
    pass("Wiederholte Ortswechsel, anonymer Schalenschnitt, gemeinsamer Ortskatalog und Tablet-Hochformat");
  } catch (err) {
    console.error(engine, "Letzter Zustand", await diagnostics(page).catch(()=>null), await page.locator("#sidebar").innerText().catch(()=>""));
    throw err;
  } finally {
    await context.close();
  }
}
async function recordDemo(browser) {
  const temp = await mkdtemp(join(tmpdir(),"georisiko-g21-video-"));
  const context = await browser.newContext({
    viewport: {width:1440,height:900}, deviceScaleFactor:1, hasTouch:true,
    recordVideo: { dir:temp, size:{width:1152,height:720} },
  });
  try {
    const p = await context.newPage();
    const video = p.video();
    await p.goto(url); await settled(p);
    await p.tap("#nav-plates");
    await plainAtlas(p);await p.tap("#boundaries");
    await p.tap("#plateSettings summary");
    await p.tap("#boundaryTypes");
    await p.tap("#plateNames");
    await p.waitForTimeout(700);
    for (const site of sites) {
      await choose(p,site.id);
      await p.tap("#playProcess");
      await p.waitForFunction(()=>window.geoObservatory().tectonics.progress>0.23);
      await p.tap("#playProcess");
      await p.waitForTimeout(600);
      await p.emulateMedia({reducedMotion:"reduce"});
      await p.tap("#regionalOverview");
      await settled(p);
      await p.waitForTimeout(600);
      await p.tap("#plateOverview");
      await settled(p);
    }
    await p.tap("#nav-inside");
    await settled(p);
    await p.waitForTimeout(800);
    await context.close();
    await video.saveAs(join(dest,"bedienung.webm"));
  } finally {
    await context.close();
    await rm(temp,{recursive:true,force:true});
  }
}
function measurementReport() {
  const rows = ["# Browser-Messbericht Plattentektonik G2.1", "", "Git-Stand `"+report.commit+"`.", "",
    "Die beiden Browser liefen unter Linux mit Softwaregrafik. Die Messfenster zeigen die laufenden lokalen Modelle bei 1920 × 1080 mit eingeblendeter Smartboard-Steuerung. Die Browser-Aufzeichnung entstand in einem getrennten Durchlauf.", ""];
  for (const run of report.runs) {
    rows.push("## "+run.engine+" "+run.version, "", "| Modell | FPS | Median | P95 | längster Abstand | Abstände > 250 ms | Renderpuffer |", "|---|---:|---:|---:|---:|---:|---|");
    for (const [site,s] of Object.entries(run.cadence))
      rows.push(`| ${site} | ${s.fps.toFixed(1)} | ${s.medianMs.toFixed(0)} ms | ${s.p95Ms.toFixed(0)} ms | ${s.maxMs.toFixed(0)} ms | ${s.gapsOver250ms} | ${s.resolution.width} × ${s.resolution.height} |`);
    const f = run.flight;
    if (f) rows.push("", `Der Flug nach Island dauerte ${(f.ms/1000).toFixed(1)} s. ${f.frames} Bildproben, längster Abstand ${f.maxGapMs} ms, ${f.gapsOver250ms} Abstände über 250 ms. Alle Kameraposen und Sichtbarkeitswechsel stehen in pruefung.json.`);
    if (run.resources.length) {
      rows.push("", "| Rundreise | Geometrien | Texturen | Programme | Geländeteile auf GPU | JS-Heap |","|---:|---:|---:|---:|---:|---:|");
      run.resources.forEach((r,i) => rows.push(`| ${i+1} | ${r.geometries} | ${r.textures} | ${r.programs} | ${r.uploadedTiles} | ${r.heapBytes===null ? "nicht verfügbar" : (r.heapBytes/1048576).toFixed(1)+" MiB"} |`));
    }
    if (run.cadence.island) rows.push("", "Renderer: "+run.cadence.island.renderer+".",
      "Modellfläche nach Abzug des überdeckenden Bedienfelds am Smartboard: mindestens "+(100*run.boardArea).toFixed(1)+" %.", "");
  }
  return rows.join("\n")+"\n";
}
try {
  for (const engine of (process.env.TEST_ENGINES ?? "chromium,webkit").split(",")) {
    assert.ok(["chromium","webkit"].includes(engine));
    const browser = await (engine==="chromium" ? chromium : webkit).launch({
      executablePath: process.env[engine==="chromium" ? "CHROMIUM_PATH" : "WEBKIT_PATH"] || undefined,
      args: engine==="chromium" ? ["--use-angle=swiftshader","--enable-unsafe-swiftshader"] : [],
    });
    try { await exercise(browser,engine); if (engine==="chromium") await recordDemo(browser); }
    finally { await browser.close(); }
  }
} catch (err) {
  report.failure = String(err.stack ?? err);
  console.error(err);
  process.exitCode=1;
} finally {
  await writeFile(join(dest,"pruefung.json"),JSON.stringify(report,null,2));
  await writeFile(join(dest,"Messbericht.md"),measurementReport());
  await server.close();
}
