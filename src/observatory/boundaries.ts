import locations from "./sites.json";
import { center, type Step } from "../tectonics/atlas";

export type Process = "ridge" | "rift" | "subduction" | "arc" | "collision" | "convergence" | "transform" | "oceanTransform" | "complex" | "hotspot";
export const processNames: Record<Process,string> = {
  ridge:"Ozeanischer Rücken", rift:"Kontinentaler Graben", subduction:"Subduktionszone", arc:"Ozeanischer Inselbogen",
  collision:"Kontinentkollision", convergence:"Annäherung", transform:"Seitliche Störung", oceanTransform:"Seitliche Störung am Meeresboden",
  complex:"Komplexe Grenzzone", hotspot:"Hotspot"
};
export const sites = locations;
export type Site = keyof typeof sites;
export function classify(step:Step):Process {
  const {lat,lon}=center(step);
  const across=Math.abs(Math.sin((localStrike(step)-step[8])*Math.PI/180));
  if((step[2]==="OCB"||step[2]==="CCB") && across<.38)return "complex";
  switch (step[2]) {
    case "CTF":return "transform";
    case "OTF":return "oceanTransform";
    case "OSR":return "ridge";
    case "CRB":return "rift";
    case "CCB":return lat>=24 && lat<=38 && lon>=62 && lon<=99 ? "collision":"convergence";
    case "SUB":
      if ((lon>=138 && lon<=150 && lat>=9 && lat<=25) || (lon>=-179 && lon<=-170 && lat>=-34 && lat<=-15)) return "arc";
      return "subduction";
    case "OCB":return "convergence";
    default:return "complex";
  }
}
export function localStrike(s:Step) {
  const rad=Math.PI/180, d=(s[5]-s[3])*rad, a=s[4]*rad,b=s[6]*rad;
  return (Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d))/rad+360)%360;
}
