import {chromium} from 'playwright';import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const dir=process.argv[2];if(!dir)throw Error('Zielverzeichnis für die Ansichten fehlt');await mkdir(dir,{recursive:true});
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{const p=await b.newPage();await p.goto('http://localhost:4847/scripts/g61/impostors.html');await p.waitForFunction(()=>!!window.capture);
for(const name of ['tree_small_02','shrub_02','pine_tree_01','grass_medium_01','rock_07','drygrass']){const frames=await p.evaluate(n=>window.capture(n),name);for(const [i,img] of frames.entries())await writeFile(join(dir,name+i+'.png'),Buffer.from(img.split(',')[1],'base64'));}}finally{await b.close();}
