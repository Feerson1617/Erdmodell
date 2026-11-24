// Render the released G5.1 single file, using the G5.2 overhead camera for matched comparisons.
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {fullHDPhoto} from "../../tests/native-picture.mjs";
const [base,current,output]=process.argv.slice(2);
if(!base||!current||!output)throw Error("Aufruf: node scripts/g52/reference-views.mjs G5.1.html G5.2.html Zielordner");
await mkdir(output,{recursive:true});
const b=await chromium.launch({args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try{
  const page=async file=>{const p=await b.newPage({viewport:{width:1920,height:1080},reducedMotion:"reduce"});
    // Three.js exposes renderers to DevTools. Override only the pose during the capture of the regional scene.
    await p.addInitScript(()=>{window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener("observe",({detail:r})=>{
      if(!r.isWebGLRenderer)return;const render=r.render.bind(r);
      r.render=(scene,camera)=>{const pose=window.matchedPose;if(!pose||camera.far!==120)return render(scene,camera);
        const pos=camera.position.clone(),rot=camera.quaternion.clone();camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld();
        try{window.poseFrames=(window.poseFrames||0)+1;return render(scene,camera);}finally{camera.position.copy(pos);camera.quaternion.copy(rot);camera.updateMatrixWorld();}};});});
    await p.goto(pathToFileURL(resolve(file)).href);await p.waitForFunction(()=>window.geoObservatory?.().ready);
    await p.click("#present");await p.click("#nav-earthquake");await p.selectOption("#g-launch","san");await p.waitForFunction(()=>{const w=window.geoObservatory();return !w.flying&&w.observatory.ready;});return p;};
  const now=await page(current);await now.selectOption("#g-view","overhead");const camera=await now.evaluate(()=>window.geoObservatory().observatory.camera);await now.close();
  const old=await page(base),cdp=await old.context().newCDPSession(old);
  await old.evaluate(pose=>window.matchedPose=pose,camera);await old.click("#obswitch");await old.waitForFunction(()=>window.poseFrames>=2);
  for(const [phase,name] of [[0,"03-Weg-vorher"],[.3,"04-Spannungsaufbau"],[.49,"05-Versatz"],[1,"06-Weg-nachher"]]){
    if(phase===.3){await old.click("#obswitch");await old.locator("details").filter({has:old.locator("#g-stress")}).locator("summary").click();await old.check("#g-stress");await old.click("#obswitch");}
    await old.locator("#observe-progress").fill(String(phase));await fullHDPhoto(old,cdp,output,name);
  }
  await writeFile(resolve(output,"Kamera.json"),JSON.stringify({camera,renderedFrames:await old.evaluate(()=>window.poseFrames),baseline:"214cc18f1334374d490feb5a72411ca94eaf8a9e",dimensions:[1920,1080]},null,2));
}finally{await b.close();}
