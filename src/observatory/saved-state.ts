// Snapshots contain only the named model settings. Methods and renderer objects stay in memory.
export function fields<T,K extends keyof T>(model:T,keys:readonly K[]):Pick<T,K>{
  return Object.fromEntries(keys.map(k=>[k,model[k]])) as Pick<T,K>;
}
export const regionKeys=["reliefOnly","forceLayers","facies","analysis","progress","playing","stress","names","moreNames","showP","showS","detail","phasesShown","slow","vectors","riskSite","soil","eruption","protection","safeRoute","warning","relocate","exposure"] as const;
export const timeKeys=["year","scenario","compare","comparison","direction","speed","playing","layer","gnss","tracking","trail","follow","showBoundaries","overview"] as const;
export const lessonKeys=["view","measure","progress","playing","slow","dissolved","air"] as const;
