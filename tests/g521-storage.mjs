import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
const out=process.env.G521_OUT??"test-results/mac/G521",key="georisiko.unterrichtsansichten.v1";
await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{channel:"chrome",headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try{
 const p=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:"reduce"});
 await p.goto(pathToFileURL(resolve("artifacts/GeoRisiko-G6-Web-Test.html")).href);
 await p.waitForFunction(()=>window.geoObservatory?.().ready);
 await p.click("#saved-views");await p.selectOption("#saved-list","p3");await p.click("#view-apply");await p.waitForSelector("dialog.classroom-views",{state:"hidden"});
 await p.click("#saved-views");await p.fill("#view-name","Legacy");await p.click("#view-save");await p.click("#view-close");
 const [legacy]=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);delete legacy.format;delete legacy.scene.region.settings.analysis;
 const invalid=structuredClone(legacy);invalid.scene.region.position=[0,"falsch",0];
 const future={...legacy,format:909};await p.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify(v)),[key,[future,legacy,invalid]]);
 await p.click("#saved-views");assert.equal(await p.locator("#saved-list option").count(),9);assert.match(await p.locator(".classroom-views small").innerText(),/beschädigt/);
 await p.selectOption("#saved-list","s0");await p.click("#view-apply");await p.waitForSelector(".classroom-views",{state:"hidden"});assert.equal(await p.evaluate(()=>window.geoObservatory().observatory.progress),.3);
 await p.evaluate(k=>localStorage.setItem(k,"{ defekt"),key);await p.click("#saved-views");assert.equal(await p.locator("#saved-list option").count(),8);assert.match(await p.locator(".classroom-views small").innerText(),/gelesen/);
 await p.fill("#view-name","Wiederhergestellt");await p.click("#view-save");assert.equal(await p.locator("#saved-list option").count(),9);
 await writeFile(join(out,"Speicher.json"),JSON.stringify({versionlessRestored:true,malformedEntryFiltered:true,futureFormatFiltered:true,brokenJSONRecovered:true,presets:8},null,2));
}finally{await browser.close();}
