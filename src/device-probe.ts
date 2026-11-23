// Invoked only for a local device measurement. All samples stay in memory.
export async function deviceProbe(milliseconds: number) {
  const read = () => {
    const s = (window as unknown as {geoObservatory: () => Record<string, unknown>}).geoObservatory();
    return Object.fromEntries(["mode","region","resolution","draws","triangles","textures","geometries","programs"].map(k => [k,s[k]]));
  };
  const started = await new Promise<number>(requestAnimationFrame);
  const states = [read()], gaps: number[] = [];
  let previous = started;
  while (previous - started < milliseconds) {
    const now = await new Promise<number>(requestAnimationFrame);
    gaps.push(now - previous);
    previous = now;
    if (gaps.length % 12 === 0) states.push(read());
  }
  states.push(read());
  const ordered = [...gaps].sort((a,b) => a-b);
  return { elapsedMs: previous-started, frames:gaps.length, fps:1000*gaps.length/(previous-started),
    median:ordered[Math.floor(ordered.length/2)], p95:ordered[Math.floor((ordered.length-1)*.95)],
    max:ordered[ordered.length-1], gaps, states };
}
