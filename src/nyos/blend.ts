// Shared between the two surfaces. A given framebuffer sample belongs to
// exactly one terrain throughout the change of resolution.
export const nyosBlendGLSL = `
float nyosCoverage(vec2 uv, float weight) {
  vec2 edge = min(uv, vec2(1.0) - uv);
  return weight * smoothstep(0.0, 0.05, min(edge.x, edge.y));
}
float nyosPixelThreshold() {
  vec2 p = floor(gl_FragCoord.xy);
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}`;
