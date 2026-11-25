import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const out=resolve(process.env.G61_OUT??'test-results/g61');
await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{channel:'chrome',headless:false}:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const p=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  const errors=[],net=[],lava=[],roots=[];let localFlow;p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(/^https?:/.test(r.url()))net.push(r.url());});
  p.setDefaultTimeout(120000);
  await p.addInitScript(()=>{window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',({detail:r})=>{
    if(r.isWebGLRenderer){const draw=r.render.bind(r);r.render=(s,c)=>{window.regionDraw=s;return draw(s,c);};}
  });});
  await p.goto(pathToFileURL(resolve('artifacts/GeoRisiko-G6.4-Web-Test.html')).href);
  await p.waitForFunction(()=>window.geoObservatory?.().ready);
  const ready=()=>p.waitForFunction(()=>{const w=window.geoObservatory(),r=w.observatory;return !w.flying&&r.mode==='regional'&&r.ready&&r.viewSettled;});
  const paint=()=>p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await p.click('#nav-volcano');await ready();
  for(const site of ['island','hawaii','japan']){
    await p.selectOption('#g-site',site);await ready();
    for(const phase of [.71,.87,.98]){
      await p.locator('#g-progress').fill(String(phase));await paint();
      const rows=await p.evaluate(()=>{const rows=[];window.regionDraw.traverseVisible(m=>{
        if(!m.userData.track)return;const p=m.geometry.attributes.position,points=m.userData.track;
        let maxClimb=0;for(let i=1;i<points.length;i++)maxClimb=Math.max(maxClimb,p.getY(i*9+4)-p.getY((i-1)*9+4));
        rows.push({samples:points.length,drawnIndices:m.geometry.drawRange.count,maxClimb,drop:points[0][1]-points.at(-1)[1]});
      });return rows;});
      assert.ok(rows.some(r=>r.samples>3&&r.drawnIndices>0),JSON.stringify({site,phase,rows}));
      assert.ok(rows.every(r=>r.maxClimb<.00001),JSON.stringify({site,phase,rows}));lava.push({site,phase,rows});
    }
  }
  await p.selectOption('#g-site','island');await ready();await p.selectOption('#g-view','ground');await ready();await p.locator('#g-progress').fill('0.95');await paint();
  localFlow=await p.evaluate(()=>{const m=window.regionDraw.getObjectByName('Lavafluss'),a=m.geometry.attributes.position,t=m.userData.track;
    return {metres:Math.hypot(t.at(-1)[0]-t[0][0],t.at(-1)[2]-t[0][2]),indices:m.geometry.drawRange.count,maxClimb:Math.max(...t.slice(1).map((_,i)=>a.getY((i+1)*9+4)-a.getY(i*9+4)))};});
  assert.ok(localFlow.metres>7&&localFlow.indices>0&&localFlow.maxClimb<.00001,JSON.stringify(localFlow));
  for(const site of ['san','island','japan','rift','himalaya','hawaii']){
    await p.click(site==='hawaii'?'#nav-volcano':'#nav-earthquake');if(site==='hawaii')await ready();
    await p.selectOption(site==='hawaii'?'#g-site':'#g-launch',site);await ready();
    await p.locator('#g-progress').fill('0.49');await p.selectOption('#g-view','ground');await ready();await paint();
    const anchors=await p.evaluate(()=>{
      const result={count:0,maxAbove:0,minHeight:Infinity,scanned:0};
      window.regionDraw.traverseVisible(m=>{
        if(!m.isInstancedMesh||!m.count)return;
        const bed=m.parent.children.find(o=>o.name==='Nahgelände')?.geometry;if(!bed)return;
        const pos=bed.attributes.position,cols=89,rows=177;
        function bracket(x,n,at){let i=0,j=n-1;while(j-i>1){const k=(i+j)>>1;if(at(k)<=x)i=k;else j=k;}return i;}
        for(let k=0;k<m.count;k+=Math.max(1,Math.floor(m.count/12))){
          const mat=m.instanceMatrix.array,x=mat[k*16+12],y=mat[k*16+13],z=mat[k*16+14];
          const i=bracket(x,cols,i=>pos.getX(i)),j=bracket(z,rows,j=>pos.getZ(j*cols)),a=i+j*cols;
          const u=(x-pos.getX(a))/(pos.getX(a+1)-pos.getX(a)),v=(z-pos.getZ(a))/(pos.getZ(a+cols)-pos.getZ(a));
          const h=u+v<=1?(1-u-v)*pos.getY(a)+u*pos.getY(a+1)+v*pos.getY(a+cols):(1-v)*pos.getY(a+1)+(1-u)*pos.getY(a+cols)+(u+v-1)*pos.getY(a+cols+1);
          result.count++;result.maxAbove=Math.max(result.maxAbove,y-h);result.minHeight=Math.min(result.minHeight,y);
          if(m.userData.sharedSpecimen)result.scanned++;
        }
      });return result;
    });
    assert.ok(anchors.count>0&&anchors.maxAbove<.002,JSON.stringify({site,anchors}));
    if(site==='japan')assert.ok(anchors.minHeight>-.1,JSON.stringify(anchors));
    const key=await p.evaluate(()=>window.regionDraw.getObjectByName('Nahgelände').material.customProgramCacheKey());
    assert.equal(key,'local-ground-'+(['island','hawaii'].includes(site)?'basalt':site==='japan'?'coast':'soil'));
    roots.push({site,anchors,material:key});await p.screenshot({path:join(out,'Nah-'+site+'.jpg'),type:'jpeg',quality:86});await p.selectOption('#g-view','cut');await ready();
    assert.equal(await p.locator('#g-progress').inputValue(),'0.49');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(net,[]);
  await writeFile(join(out,'Nahmodelle.json'),JSON.stringify({lava,localFlow,roots,errors,net},null,2));
  console.log(lava.length,'Lavatests und',roots.length,'reale Wurzel-/Maßstabsprüfungen bestanden');
}finally{await browser.close();}

