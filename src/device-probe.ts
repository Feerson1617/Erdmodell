// Invoked only for a local device measurement. All samples stay in memory.
export async function deviceProbe(milliseconds: number, finished = () => true) {
  const read = () => {
    const s = (window as unknown as {geoObservatory: () => Record<string, unknown>}).geoObservatory();
    const obs=s.observatory as Record<string,unknown>|undefined;
    const observatory=obs?Object.fromEntries(["mode","site","process","theme","year","scenario","progress"].map(k=>[k,obs[k]])):undefined;
    return {observatory,renderedFrames:Number(s.renderedFrames),...Object.fromEntries(["mode","region","resolution","draws","triangles","textures","geometries","programs","renderedFrames","frameKinds","qualityChanges"].map(k => [k,s[k]]))};
  };
  const started = await new Promise<number>(requestAnimationFrame);
  const states = [read()], gaps: number[] = [];
  let previous = started, lastState=started;
  while (previous - started < milliseconds || !finished()) {
    const now = await new Promise<number>(requestAnimationFrame);
    gaps.push(now - previous);
    previous = now;
    if(now-lastState>=1000){states.push(read());lastState=now;}
  }
  states.push(read());
  const ordered = [...gaps].sort((a,b) => a-b);
  const renderedFrames=Number(states.at(-1)!.renderedFrames)-Number(states[0].renderedFrames);
  return { renderedFrames,renderedFps:1000*renderedFrames/(previous-started),elapsedMs: previous-started, frames:gaps.length, fps:1000*gaps.length/(previous-started),
    median:ordered[Math.floor(ordered.length/2)], p95:ordered[Math.floor((ordered.length-1)*.95)],
    max:ordered[ordered.length-1], gaps, states };
}
