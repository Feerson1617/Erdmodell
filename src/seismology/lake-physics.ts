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

export type GasCase = "rich" | "weak";

// Dimensionless teaching model. Both parcels start with the same external lift.
// The transition is a property of this example, not a concentration threshold.
export function gasParcel(time: number, seed: number, example: GasCase) {
  const elapsed = Math.max(0, time - 0.14 - 0.08 * seed);
  const liftTime = 0.23;
  const lift = 0.2;
  const initial = lift * Math.min(1, elapsed / liftTime);
  const afterLift = Math.max(0, elapsed - liftTime);
  if (example === "weak") {
    const settle = Math.min(1, afterLift / 0.57);
    return { rise: initial * (1 - 0.72 * settle ** 2), free: 0 };
  }
  const rise = Math.min(
    1,
    initial + (lift / liftTime) * afterLift + 2.7 * afterLift ** 2,
  );
  return { rise, free: Math.max(0, (rise - lift) / (1 - lift)) };
}

export function dissolvedTint(
  depth: number,
  across: number,
  time: number,
  example: GasCase,
) {
  const u = Math.max(0, Math.min(1, (depth - 0.17) / 0.74));
  const stratification = u * u * (3 - 2 * u);
  if (example === "weak") return 0.22 * stratification;
  const parcel = gasParcel(time, 0, example);
  // A lightening along the processed path, with dissolved gas left at the sides.
  // The analysis colour is qualitative and has no mass-balance interpretation.
  const processed = Math.max(
    0,
    Math.min(1, (parcel.rise - (1 - depth) + 0.28) / 0.3),
  );
  return (
    stratification *
    (1 - 0.67 * parcel.free * processed * Math.exp(-5 * across * across))
  );
}
