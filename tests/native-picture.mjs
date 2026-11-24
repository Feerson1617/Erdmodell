import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import {join} from "node:path";

// Electron can restore the virtual monitor size on entering or leaving macOS fullscreen.
export async function fullHDPhoto(page,session,dir,name){
  const width=1920,height=1080;
  for(let attempt=0;attempt<3;attempt++){
    await session.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
    await page.waitForFunction(()=>innerWidth===1920&&innerHeight===1080);
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const data=await page.screenshot({type:"jpeg",quality:85});
    // Read the JPEG frame header. Window dimensions alone do not certify the capture.
    for(let offset=2;offset+9<data.length;){
      assert.equal(data[offset],255,"JPEG-Segment");
      const type=data[offset+1],size=data.readUInt16BE(offset+2);
      if([0xc0,0xc1,0xc2].includes(type)){
        if(data.readUInt16BE(offset+5)===height&&data.readUInt16BE(offset+7)===width){
          await writeFile(join(dir,name+".jpg"),data);return;
        }
        break;
      }
      if(type===0xda||size<2)break;offset+=size+2;
    }
  }
  throw new Error(name+" wurde nach dem Vollbildwechsel nicht mit 1920 × 1080 Pixeln gerendert.");
}
