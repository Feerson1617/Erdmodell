const tau = Math.PI * 2;
export function basinFloor(x: number) {
  return -Math.pow(Math.max(0, 1 - x * x), 0.69);
}
// x is a fraction of half the basin width. Depth is positive down from the surface.
export function circulationPoint(
  time: number,
  seed: number,
  meromictic: boolean,
) {
  const cooling = (1 - Math.cos(time * tau)) / 2;
  const angle = tau * (time * 2 + seed);
  const excluded = meromictic && seed > 0.77;
  const x = Math.cos(angle) * (0.42 + 0.22 * Math.sin(seed * 13) ** 2);
  const depth = excluded
    ? 0.72 + 0.045 * Math.sin(angle)
    : 0.055 +
      (0.17 + (meromictic ? 0.08 : 0.68) * cooling) *
        (0.5 + 0.5 * Math.sin(angle));
  return { x, depth: depth * -basinFloor(x), cooling, excluded };
}
export function plumeParcel(t: number, seed: number, saturated: boolean) {
  const release = Math.min(1, Math.max(0, (t - 0.24) / 0.65));
  const u = Math.min(
    1,
    Math.max(0, (release - seed * 0.24) / (1 - seed * 0.24)),
  );
  const rise = saturated
    ? 0.18 * u + 0.82 * u * u
    : 0.27 * Math.sin(u * Math.PI * 0.86);
  const exsolved = saturated ? Math.max(0, (rise - 0.18) / 0.82) : 0;
  return { rise, exsolved };
}
