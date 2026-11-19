import * as T from "three";

// A narrow overlap with the intact image feathers the margins of the teaching cut.
export const sectionExtent = { side: 32, back: 21, front: 36 };

/** Expose the regional section in the two existing Earth surfaces, using the same
 * dither as the arriving model. All coordinates and the camera remain geographic.
 */
export class SectionWindow {
  private frame = { value: new T.Matrix4() };
  private reveal = { value: 0 };
  private attached = new WeakSet<T.Material>();
  private active?: T.Group;
  attach(material: T.Material) {
    if (this.attached.has(material)) return;
    this.attached.add(material);
    const original = material.onBeforeCompile.bind(material);
    const previousKey = material.customProgramCacheKey();
    material.customProgramCacheKey = () => previousKey + "-section-window";
    material.onBeforeCompile = (shader, renderer) => {
      original(shader, renderer);
      Object.assign(shader.uniforms, {
        sectionFrame: this.frame,
        sectionReveal: this.reveal,
      });
      shader.vertexShader =
        "uniform mat4 sectionFrame; uniform float sectionReveal; varying vec3 vSection;\n" +
        shader.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\n vSection = sectionReveal > 0. ? (sectionFrame * modelMatrix * vec4(transformed,1.)).xyz : vec3(0.);",
        );
      shader.fragmentShader =
        "uniform float sectionReveal; varying vec3 vSection;\n" +
        shader.fragmentShader.replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
        if (sectionReveal > 0. && abs(vSection.y) < 35. && abs(vSection.x) < ${sectionExtent.side - 3}. &&
            vSection.z > -${sectionExtent.back - 3}. && vSection.z < ${sectionExtent.front - 5}.) {
          float noise = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
          if (noise < sectionReveal) discard;
        }`,
        );
    };
    material.needsUpdate = true;
  }
  show(group: T.Group | undefined, amount: number) {
    this.reveal.value = group ? amount : 0;
    if (group && group !== this.active) {
      group.updateWorldMatrix(true, false);
      this.frame.value.copy(group.matrixWorld).invert();
    }
    this.active = group;
  }
}
