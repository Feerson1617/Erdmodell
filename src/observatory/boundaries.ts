import locations from "./sites.json";
import fields from "./pb-fields.json";
import referenceSteps from "./reference-steps.json";
import { center, type Step } from "../tectonics/atlas";

export type Process="ridge"|"rift"|"subduction"|"arc"|"collision"|"convergence"|"transform"|"oceanTransform"|"complex"|"hotspot";
export const processNames:Record<Process,string>={ridge:"Ozeanischer Rücken",rift:"Kontinentaler Graben",subduction:"Subduktionszone",arc:"Ozeanischer Inselbogen",collision:"Kontinentkollision",convergence:"Annäherung",transform:"Seitliche Störung",oceanTransform:"Seitliche Störung am Meeresboden",complex:"Komplexe Grenzzone",hotspot:"Hotspot"};
export const sites=locations;
export type Site=keyof typeof sites;
export const localStrike=(s:Step)=>Number(fields[s[0]-1][0])%360;
export function classify(s:Step):Process{
  const category=s[2],pair=s[1],f=fields[s[0]-1],over=pair[2]==="/"?pair.slice(0,2):pair.slice(3);
  if(category==="SUB")return ["MA","TO","KE"].includes(over)?"arc":"subduction";
  if((category==="CCB"||category==="OCB")&&Math.abs(Number(f[1]))<.38*s[7])return "complex";
  if(category==="CCB"&&["IN-EU","EU-IN"].includes(pair))return "collision";
  return ({CTF:"transform",OTF:"oceanTransform",OSR:"ridge",CRB:"rift",CCB:"convergence",OCB:"convergence"} as Record<string,Process>)[category]??"complex";
}
export function geology(s:Step){
  const f=fields[s[0]-1],strike=localStrike(s),left=s[1].slice(0,2),right=s[1].slice(3),symbol=s[1][2];
  const sub=s[2]==="SUB"&&["/","\\"].includes(symbol);
  const down=sub?(symbol==="\\"?left:right):null,over=sub?(down===left?right:left):null;
  const dipAzimuth=sub?(strike+(down===left?90:270))%360:null;
  const elevation=Number(f[3]),worldElevation=Number(f[4]),surface=elevation<0?"Unter dem Meer":"An Land";
  const coastalUncertainty=Math.abs(elevation)<100||Math.sign(elevation)!==Math.sign(worldElevation);
  const model=classify(s),regionalDEM=(Object.keys(referenceSteps) as (keyof typeof referenceSteps)[]).find(k=>referenceSteps[k][0]===s[0])??null;
  return {id:s[0],pair:s[1],category:s[2],...center(s),strike,left,right,relativeAzimuth:s[8],relativeSpeedMmPerYear:s[7],
    divergent:Number(f[1]),dextral:Number(f[2]),elevation,worldElevation,surface,coastalUncertainty,marine:!coastalUncertainty&&elevation<0,oblique:sub&&Math.abs(Number(f[2]))>=.5*s[7],localQuake:model!=="complex",
    descending:down,overriding:over,polarity:sub?symbol:null,dipAzimuth,orogen:Boolean(f[5]),model,regionalDEM,
    lithosphere:sub?(model==="arc"?"Ozeanische Unterplatte · Inselbogen":"Unterplatte meist ozeanisch · obere Lithosphäre örtlich offen"):s[2][0]==="O"?"Ozeanisch geprägt":"Kontinental geprägt",
    scope:regionalDEM?"Referenzregion mit idealisiertem Untergrund":["complex","convergence"].includes(model)?"Allgemeines Anschauungsmodell":"Regional angepasstes Anschauungsmodell",
    source:"Bird 2003 PB2002 · ETOPO5 am Grenzschritt · globales Geländeraster 0,5°",faultTrace:regionalDEM==="san"?"GEM UCF_32":regionalDEM==="japan"?"USGS Slab2":null,
    ruptureGeometry:regionalDEM==="japan"?"Slab2-Eingangsprofil Miyagi mit schematischer Fortsetzung":"schematisch",eventMechanism:null};
}
export type Geology=ReturnType<typeof geology>;
export function referenceGeology(site:Site){return site==="hawaii"?undefined:geology(referenceSteps[site] as Step);}

