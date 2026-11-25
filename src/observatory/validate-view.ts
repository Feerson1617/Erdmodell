import { atlasLayers } from "./research-data";
import sites from "./sites.json";

const record=(x:unknown):x is Record<string,unknown>=>typeof x==="object"&&x!==null&&!Array.isArray(x);
const number=(x:unknown,lo=-Infinity,hi=Infinity):x is number=>typeof x==="number"&&Number.isFinite(x)&&x>=lo&&x<=hi;
const unit=(x:unknown)=>number(x,0,1);
const flag=(x:unknown)=>typeof x==="boolean";
const one=(x:unknown,values:string)=>typeof x==="string"&&values.split("|").includes(x);
const flags=(x:Record<string,unknown>,keys:string)=>keys.split(" ").every(k=>flag(x[k]));
const vec=(x:unknown)=>Array.isArray(x)&&x.length===3&&x.every(n=>number(n,-100,100));
const models="past|ultima|novo|aurica|amasia";

export function readableView(e:unknown){
  if(!record(e)||e.format!==undefined&&e.format!==1||typeof e.name!=="string"||!e.name.trim()||e.name.length>64||!flag(e.observing)||!record(e.scene)||!record(e.base))return false;
  const b=e.base,s=e.scene,p=s.pose,m=s.map;
  if(!record(p)||!number(p.lat,-90,90)||!number(p.lon)||!number(p.d,.001,1e6)||!number(p.bearing)||!number(p.tilt)||!record(m)||!one(m.purpose,"events|boundaries")||!flags(m,"events lines depth"))return false;
  if(!one(b.mode,"globe|inside|nyos|place|plates")||!one(b.style,"A|B"))return false;
  if(s.mode==="map"){
    const atlas=m.research,rates=m.rates;
    if(atlas===undefined)return true;
    return m.purpose==="boundaries"&&record(atlas)&&(atlas.profile===undefined||Array.isArray(atlas.profile)&&atlas.profile.length<=2&&atlas.profile.every(p=>record(p)&&number(p.lat,-90,90)&&number(p.lon,-180,180)))&&flag(atlas.flat)&&Array.isArray(atlas.layers)&&atlas.layers.every(v=>typeof v==="string"&&Object.hasOwn(atlasLayers,v))&&number(atlas.magnitude)&&[6,7,8].includes(atlas.magnitude)&&number(atlas.depth)&&[70,300,750].includes(atlas.depth)&&
      (rates===undefined||record(rates)&&Array.isArray(rates.ids)&&rates.ids.length===2&&rates.ids.every(v=>Number.isInteger(v)&&number(v,1,5819))&&one(rates.unit,"mm|cm")&&number(rates.years)&&[1000,100000,1000000].includes(rates.years)&&flag(rates.opened));
  }
  if(s.mode==="time"){
    const t=s.time;return record(t)&&one(t.scenario,models)&&one(t.comparison,models)&&number(t.year,-250,250)&&(t.direction===1||t.direction===-1)&&number(t.speed,1,30)&&flags(t,"compare playing trail follow showBoundaries")&&["layer","tracking","gnss"].every(k=>typeof t[k]==="string");
  }
  if(s.mode==="regional"){
    const r=s.region;if(!record(r)||!record(r.settings)||!vec(r.position)||!vec(r.target)||!flag(r.cut)||!one(r.view,"land|overhead|cut|fault|focus|waves|water|ocean|coast|vent|mouth|local|ground"))return false;
    const v=r.settings;
    return one(r.theme,"process|earthquake|volcano|risk|forces|lithosphere|magnet")&&(r.event===undefined||one(r.event,"strike|uplift|buried"))&&
      (r.coast===true||r.event==="strike"||typeof r.site==="string"&&Object.hasOwn(sites,r.site)||Number.isInteger(r.boundary)&&number(r.boundary,1,5819)||one(r.theme,"forces|lithosphere"))&&
      unit(v.progress)&&flags(v,"playing stress names showP showS detail phasesShown slow vectors protection safeRoute warning relocate")&&
      (v.moreNames===undefined||flag(v.moreNames))&&(v.analysis===undefined||flag(v.analysis))&&one(v.soil,"rock|loose")&&one(v.eruption,"effusive|explosive")&&one(v.exposure,"dense|sparse|empty")&&one(v.riskSite,"near|far");
  }
  if(s.mode!=="")return false;
  if(b.mode==="inside"){const h=b.shell;return record(h)&&flags(h,"subdued cut")&&one(h.comparison,"reference|expanded|lithosphere")&&
    (h.selected===null||Number.isInteger(h.selected)&&number(h.selected,0,3))&&Array.isArray(h.visible)&&h.visible.length===4&&h.visible.every(flag)&&Array.isArray(h.opacity)&&h.opacity.length===4&&h.opacity.every(unit)&&flag(b.labels)&&Array.isArray(b.released)&&b.released.every(i=>Number.isInteger(i)&&number(i,0,3));}
  if(b.mode==="nyos"){const n=b.nyos;return record(n)&&one(n.view,"lake|section|event|protection")&&one(n.measure,"pipe|monitor|settlements")&&unit(n.progress)&&flags(n,"playing slow dissolved air")&&flag(b.nyosDetail);}
  if(b.mode==="plates"){const q=b.process,o=b.plates;return record(q)&&record(o)&&flags(o,"boundaries names types")&&typeof o.category==="string"&&typeof o.plate==="string"&&
    (q.processSite===null||one(q.processSite,"island|japan|san"))&&unit(q.processProgress)&&flags(q,"processPlaying processSlow processLoop processDetail singlePlateName smallPlateNames")&&(b.pairStep===undefined||Number.isInteger(b.pairStep)&&number(b.pairStep,1,5819))&&unit(b.pairTime)&&flags(b,"pair pairPlaying")&&typeof b.profile==="string";}
  return b.mode==="globe"||typeof b.site==="string";
}
