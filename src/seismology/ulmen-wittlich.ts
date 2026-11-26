export const towns = {
  ulmen: { lat: 50.2082684, lon: 6.979957 },
  wittlich: { lat: 49.9850353, lon: 6.88844 },
  maar: { lat: 50.2106, lon: 6.9828 },
};

export function greatCircleKm(a: typeof towns.ulmen, b: typeof towns.ulmen) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
