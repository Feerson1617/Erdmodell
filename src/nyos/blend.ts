// Fade the local image into its geographical surroundings at the DEM margin.
export const nyosBlendGLSL = `
float nyosCoverage(vec2 uv, float weight) {
  vec2 edge = min(uv, vec2(1.0) - uv);
  return weight * smoothstep(0.0, 0.05, min(edge.x, edge.y));
}
`;
