export const shearModulus = 30e9;
export function moment(
  areaM2: number,
  slipM: number,
  rigidityPa = shearModulus,
) {
  return rigidityPa * areaM2 * slipM;
}
export const magnitude = (newtonMetres: number) =>
  (2 / 3) * (Math.log10(newtonMetres) - 9.1);
export function referenceSource(mw: number) {
  const scale = 10 ** ((mw - 6) / 2),
    length = 20000 * scale,
    width = 10000 * scale;
  const slip = 10 ** (1.5 * mw + 9.1) / (shearModulus * length * width);
  return { length, width, slip, moment: moment(length * width, slip) };
}
export const speed = { p: 6, s: 3.5, love: 3.25, rayleigh: 3.1 } as const; // km/s in the chosen elastic model
export type Wave = keyof typeof speed;
export const arrival = (distanceKm: number, wave: Wave) =>
  distanceKm / speed[wave];
export function packet(age: number, frequency = 1, decay = 1.8) {
  if (age <= 0) return 0;
  return (
    Math.sin(age * 2 * Math.PI * frequency) *
    Math.exp(-age / decay) *
    (1 - Math.exp(-4 * age))
  );
}
export function displacement(wave: Wave, km: number, sec: number, depthKm = 0) {
  const age = sec - arrival(km, wave);
  if (age <= 0) return [0, 0, 0];
  const q = packet(age),
    envelope = age > 0 ? (1 - Math.exp(-4 * age)) * Math.exp(-age / 1.8) : 0;
  const attenuation = Math.exp(-depthKm / 3);
  switch (wave) {
    case "p":
      return [q, 0, 0];
    case "s":
      return [0, q, 0];
    case "love":
      return [0, 0, q * attenuation];
    case "rayleigh":
      return [
        Math.cos(age * 2 * Math.PI) * envelope * attenuation,
        q * attenuation,
        0,
      ];
  }
}
// Homogeneous path, followed by an optional illustrative local site response.
export function groundMotion(km: number, sec: number, sediment = false) {
  const attenuation = 4 / Math.sqrt(Math.max(8, km));
  const pAge = sec - arrival(km, "p"),
    sAge = sec - arrival(km, "s");
  const longitudinal = attenuation * 0.61 * packet(pAge, 1.25, 1.65);
  const transverse =
    attenuation *
    (sediment
      ? 0.52 * packet(sAge, 0.89, 1.55) + 1.48 * packet(sAge, 0.46, 4.1)
      : packet(sAge, 0.89, 1.55));
  return { longitudinal, transverse };
}
// A single inclined sensor axis records a signed component of that same displacement.
export function stationTrace(km: number, sec: number, sediment = false) {
  const m = groundMotion(km, sec, sediment);
  return (m.longitudinal + m.transverse) * Math.SQRT1_2;
}
export function volcanicTrace(id: string, sec: number) {
  if (id === "quiet") return 0.025 * Math.sin(1.5 * sec);
  if (id === "tremor")
    return sec > 4
      ? (1 - Math.exp(-(sec - 4))) *
          (0.27 * Math.sin(sec * 5) + 0.15 * Math.sin(sec * 6.4))
      : 0;
  if (id === "fluid")
    return 0.78 * packet(sec - 7, 0.58, 3.4) + 0.26 * packet(sec - 16, 0.47, 3);
  return (
    0.32 * packet(sec - 6, 2.1) +
    0.81 * packet(sec - 8.5, 1.24) +
    (id === "vt" ? 0.47 * packet(sec - 17, 1.7) : 0)
  );
}
export const mechanisms: Record<string, { dip: number; rake: number }> = {
  strike: { dip: 90, rake: 0 },
  normal: { dip: 58, rake: -90 },
  reverse: { dip: 55, rake: 90 },
  thrust: { dip: 23, rake: 90 },
  oblique: { dip: 48, rake: 42 },
  megathrust: { dip: 15, rake: 90 },
};
export function rupture(t: number, along: number, down: number) {
  const span = Math.hypot(along / 4, down / 2);
  const advance = Math.max(0, Math.min(1, (t - 0.34) * 3.7 - span * 0.67));
  return advance * advance * (3 - 2 * advance) * Math.max(0, 1 - span ** 3);
}

export function faultMotion(
  t: number,
  separation: number,
  along: number,
  down: number,
) {
  const lock = Math.exp(-Math.abs(separation) * 1.5);
  const released = rupture(t, along, down);
  const loaded = Math.min(1, t / 0.34) * Math.exp(-Math.abs(along) * 0.16);
  // Held far-field displacement relaxes its near-fault gradient as the rupture arrives.
  const elastic = 0.46 * loaded * (1 - lock) * (1 - released);
  const permanent = 0.49 * released;
  return { elastic, permanent, offset: elastic + permanent };
}
