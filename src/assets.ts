declare global {
  interface Window {
    __geoAsset?: (path: string) => string;
  }
}
/** Standalone resolves the same logical paths from its embedded asset table. */
export const localAsset = (path: string) => window.__geoAsset?.(path) ?? import.meta.env.BASE_URL + path;
