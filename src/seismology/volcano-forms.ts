import {localAsset} from "../assets";
import profiles from "./volcano-profiles.json";
import * as T from "three";
import { Stage, vec } from "./stage";
import { surface } from "./geology";
export function volcanoForms(s: Stage) {
  s.look(0.5, 3.5, 14, 0.45);
  s.halfWidth = 5.6;
  s.halfHeight = 2.4;
  s.duration = 18;
  const pair=s.view==="forms";
  for (const shield of pair ? [true,false] : [s.view==="maunaCut"]) {
    const profile=profiles[shield ? 0 : 1], radius=pair ? (shield ? 2.6 : 2.2) : 4.7, cx=pair ? (shield?-2.7:2.6) : 0;
    // One horizontal scale per labelled window. Elevations in both are doubled.
    const heightAt=(index:number)=>Math.max(0,profile.heights[index])*.001*(radius*2/profile.width)*2;
    const top=(x:number)=>heightAt(Math.max(0,Math.min(100,Math.round((x+1)*50))));
    const height=top(0);
    const positions:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[];
    for(let j=0;j<36;j++)for(let k=0;k<=100;k++){
      const i=j*101+k;
      uv.push(k/100,j/35);
      positions.push(cx+(k/50-1)*radius,heightAt(i)-.85,-j*.02*radius);
      const color=new T.Color(parseInt(profile.rgb.slice(i*6,i*6+6),16));
      colors.push(color.r,color.g,color.b);
      if(j<35&&k<100)indices.push(i,i+1,i+101,i+1,i+102,i+101);
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute("position",new T.Float32BufferAttribute(positions,3));
    geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));
    geo.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
    geo.setIndex(indices);geo.computeVertexNormals();
    const flank=s.mesh(geo,0xffffff,"Vulkanflanke");
    const material=flank.material as T.MeshStandardMaterial;
    material.vertexColors=true;
    s.pendingTextures++;
    new T.TextureLoader().load(localAsset("data/g69/profile-"+(shield?0:1)+".webp"),map=>{
      s.pendingTextures--;
      if(s.disposed){map.dispose();return;}
      map.colorSpace=T.SRGBColorSpace;
      material.vertexColors=false;material.map=map;material.needsUpdate=true;s.refresh();
    },undefined,()=>{s.pendingTextures--;});
    flank.userData.term = shield ? "Schildvulkan" : "Schichtvulkan";
    // The irregular contacts describe deposits in an idealised section.
    const contact=(i:number,x:number)=>i/9 + .037*Math.sin(i*Math.PI/9)*Math.sin(x*5+i*.8);
    s.box(cx,-1.07,-.34*radius,2*radius,.44,.68*radius,0x645a51,"Anstehendes Gestein");
    for (let i = 0; i < 9; i++) {
      surface(
        s,
        74,
        2,
        (u, v) => {
          const x = 2 * u - 1;
          return vec(
            cx + x * radius,
            -0.85 + T.MathUtils.lerp(contact(i,x),contact(i+1,x),v) * top(x),
            0.015,
          );
        },
        shield
          ? [0x645e58, 0x82766b][i % 2]
          : [0x7f6b59, 0xb79a77, 0x655c58][i % 3],
        "Ablagerung",
      );
    }
    s.label(
      vec(cx, height - 0.85, 0.04),
      shield ? "Schildvulkan" : "Schichtvulkan",
      shield
        ? "Meist breite, flach geneigte Flanken. Dünnflüssige Lava kann sich weit ausbreiten."
        : "Wiederholte Ablagerungen von Lava und vulkanischem Auswurf bauen häufig steile Flanken auf.",
    );
    if(!pair){
      const gang=s.box(cx-.07,height*.5-.95,.03,.065,height+.2,.04,0xaa5340,"Gang");
      gang.rotation.z=-.10;
      s.label(vec(cx-.11,height*.48-.96,.09),"Gang","In einer Spalte kann Schmelze zur Oberfläche aufsteigen. Der Verlauf im Schnitt ist idealisiert.");
      const liquid=s.dot(vec(),0xffa059,.055,"Aufsteigende Schmelze");
      s.animate(t=>{const u=Math.min(1,t*2);liquid.position.set(cx-.12+.10*u,-.98+(height+.13)*u,.067);liquid.visible=t>0 && t<.5;});
      s.label(vec(cx+.43*radius,top(.43)*.62-.85,.05),"Ablagerung",
        shield?"Alte Lavaströme bilden übereinanderliegende Gesteinskörper.":"Lava und lockerer vulkanischer Auswurf können sich beim Aufbau des Vulkans abwechseln.");
    }
    if (shield) {
      const flow = s.line(
        Array.from({ length: 61 }, (_, i) => {
          const u = i / 60;
          return vec(cx + u * radius, top(u) - 0.81, 0.045);
        }),
        0xef9658,
        "Lavaweg",
      );
      s.animate((t) =>
        flow.geometry.setDrawRange(0, Math.max(1, Math.floor(61 * t))),
      );
    } else {
      for (let i = 0; i < 14; i++) {
        const piece = s.dot(
          vec(),
          0xa9a39d,
          0.045 + (i % 3) * 0.018,
          "Asche und Fragmente",
        );
        s.animate((t) => {
          const u = (t * 2 + i / 14) % 1;
          piece.position.set(
            cx + Math.sin(i * 3) * u * 0.55,
            height - 0.85 + 3.4 * u * (1-u),
            0.06,
          );
          piece.visible = t > 0.12;
        });
      }
    }
  }
  s.explain(
    () =>
      "Mauna Loa · 72 km breit. Zaōzan · 20 km breit. Relief jeweils zweifach überhöht. Ablagerungen und Eruptionen sind idealisiert. Wiederholte dünnflüssige Lavaströme bauen breite Flanken auf. Lava und lockerer Auswurf können steilere Schichtvulkane aufbauen. Die Eruptionsweise kann an einem Vulkan wechseln.",
  );
}
