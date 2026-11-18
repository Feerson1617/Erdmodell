import { PerspectiveCamera, Vector3 } from "three";
import { R, basis, position } from "../geo";
import type { NyosMeta } from "./terrain";

/** Conservative occlusion of the globe by one fully opaque local terrain patch. */
export class NyosCoverage {
  private frame: ReturnType<typeof basis>;
  private origin: Vector3;
  private floor: number;
  private limits: [number, number, number, number];
  private hit = new Vector3();

  constructor(meta: NyosMeta, lowestKm: number) {
    const {lat, lon} = meta.anchor;
    this.frame = basis(lat, lon);
    this.origin = position(lat, lon);
    // The reference plane stays below the entire DSM even allowing for Earth curvature.
    this.floor = lowestKm - 0.08;
    const [w,s,e,n] = meta.bounds;
    const ix=(e-w)*0.08, iy=(n-s)*0.08;
    this.limits = [
      position(lat,w+ix).sub(this.origin).dot(this.frame.east),
      position(s+iy,lon).sub(this.origin).dot(this.frame.north),
      position(lat,e-ix).sub(this.origin).dot(this.frame.east),
      position(n-iy,lon).sub(this.origin).dot(this.frame.north),
    ];
  }
  private inside(p: Vector3) {
    const x=p.dot(this.frame.east), z=p.dot(this.frame.north);
    return x>this.limits[0] && z>this.limits[1] && x<this.limits[2] && z<this.limits[3];
  }
  containsView(camera: PerspectiveCamera) {
    const eye=camera.position;
    if (!this.inside(eye)) return false;
    const height=eye.dot(this.frame.up)-R;
    if (height<=this.floor) return false;
    // Every ray between these four corners lies in their convex footprint. Testing the
    // eye as well covers all columns between the low reference plane and the camera.
    for(const x of [-1,1]) for (const y of [-1,1]) {
      const ray=this.hit.set(x,y,0.5).unproject(camera).sub(eye).normalize();
      const incidence=ray.dot(this.frame.up);
      if(incidence>=-0.001) return false;
      ray.multiplyScalar((this.floor-height)/incidence).add(eye);
      if(!this.inside(ray)) return false;
    }
    return true;
  }
}
