// Qualitative teaching time. The pulses do not reproduce dated Ulmen explosions.
export const bursts = [0.32, 0.44, 0.55, 0.65];

export function excavation(time: number) {
  let progress = 0;
  for (const onset of bursts) {
    const u = Math.max(0, Math.min(1, (time - onset) / 0.105));
    progress += u * u * (3 - 2 * u);
  }
  return progress / bursts.length;
}

export function surfaceHeight(x: number, z: number, progress: number) {
  const angle = Math.atan2(z, x);
  const radius =
    Math.hypot(x * 0.92, z * 1.08) /
    (1 + 0.055 * Math.sin(angle * 3) + 0.034 * Math.cos(angle * 5));
  const rim = 0.72 + 1.67 * Math.sqrt(progress);
  const terrain = 0.14 * Math.sin(x * 1.1) + 0.09 * Math.cos(z * 1.8 + x * 0.3);
  const crater = -2.23 * progress * Math.max(0, 1 - (radius / rim) ** 2);
  const ejecta = 0.59 * progress * Math.exp(-((radius - rim) ** 2) / 0.24);
  return terrain + crater + ejecta;
}

export const lakeDimensions = {
  ulmen: { span: 340, depth: 38 },
  nyos: { span: 1800, depth: 208 },
};

// Intersect a horizontal water level with the inner crater slope on each ray.
export function shoreRadius(angle:number,level:number){
  let lo=0,hi=3.6;
  for(let n=0;n<19;n++){
    const r=(lo+hi)/2;
    if(surfaceHeight(r*Math.cos(angle),-r*Math.sin(angle),1)<level)lo=r;else hi=r;
  }
  return (lo+hi)/2;
}
