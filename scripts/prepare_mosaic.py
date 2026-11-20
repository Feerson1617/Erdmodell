"""Build the offline spherical mesh with Shapely 2.1, from the pinned PB2002 GIS and pole files."""
import hashlib, json, math, sys
import numpy as np
from collections import defaultdict
from pathlib import Path
from shapely import constrained_delaunay_triangles, make_valid, union_all
from shapely.geometry import box, shape, Point

root = Path(__file__).resolve().parents[1] / "src/tectonics"
def verified(file, digest):
    data = Path(file).read_bytes()
    assert hashlib.sha256(data).hexdigest() == digest
    return data
shapes = json.loads(verified(sys.argv[1], "922918f970baf7e645821a4a728b945dbb5eeac1337d71d087fba021bcc79e21"))
raw = verified(sys.argv[2], "887d208bda44cea75ee0c778c1883476906757a3d8035608a6cff7b79cf40f2e")
poles = {v[0]: list(map(float, v[1:4])) for line in raw.decode("ascii").splitlines() if (v:=line.split())}
regions = defaultdict(list)
for f in shapes["features"]:
    regions[f["properties"]["Code"]].append(make_valid(shape(f["geometry"])))
assert set(regions) == set(poles) == set(json.loads((root/"labels.json").read_text()))
def polygons(g):
    if g.geom_type == "Polygon":
        if not g.is_empty and g.area > 1e-12:
            yield g
    elif hasattr(g, "geoms"):
        for part in g.geoms:
            yield from polygons(part)
def rotation_weights(vertices, triangles, pole):
    """Limit the schematic edge deformation on narrow triangles.

    Scaling all three touched weights together converges back toward the
    original embedding. Interior regions retain their full Euler rotation.
    """
    points = np.array(vertices, dtype=float).reshape(-1,3)
    lon, lat = np.radians(points[:,0]/1e5), np.radians(points[:,1]/1e5)
    units = np.column_stack([np.cos(lat)*np.sin(lon),np.sin(lat),np.cos(lat)*np.cos(lon)])
    lat_p,lon_p,angle = np.radians(pole)
    axis = np.array([np.cos(lat_p)*np.sin(lon_p),np.sin(lat_p),np.cos(lat_p)*np.cos(lon_p)])
    axial = np.outer(units @ axis, axis)
    radial, tangent = units-axial, np.cross(axis,units)
    sweep = angle*2
    speed = np.linalg.norm(tangent,axis=1)*sweep
    weights = np.minimum(1,np.radians(points[:,2]/1e4)*.30/np.maximum(speed,1e-12))
    if not sweep:
        weights[:] = 0
    faces = np.asarray(triangles).reshape(-1,3)
    def orientation(v):
        a,b,c = v[faces[:,0]],v[faces[:,1]],v[faces[:,2]]
        return np.einsum("ij,ij->i",a,np.cross(b-a,c-a))
    rest = orientation(units)
    # At a pole, distinct GIS longitudes collapse to one physical vertex.
    assert (rest >= -1e-15).all()
    nonzero = rest > 1e-15
    faces,rest = faces[nonzero],rest[nonzero]
    triangles[:] = faces.ravel().tolist()
    weights = np.rint(weights*65535).astype(int)
    for attempt in range(64):
        bad = np.zeros(len(faces),dtype=bool)
        for time in (.125,.25,.375,.5,.625,.75,.875,1):
            phase = (sweep*time/65535*weights)[:,None]
            deformed = axial + radial*np.cos(phase) + tangent*np.sin(phase)
            bad |= (abs(rest)>1e-15) & (orientation(deformed)*np.sign(rest) < abs(rest)*.12)
        if not bad.any():
            assert not sweep or weights.any()
            return weights.tolist()
        touched = np.unique(faces[bad])
        weights[touched] //= 2
    raise ValueError("Plattenfläche faltet sich während der Bewegung")

data = {}
for code in sorted(regions):
    poly = union_all(list(p for g in regions[code] for p in polygons(g)))
    assert poly.contains(Point(*json.loads((root/"labels.json").read_text())[code])), code
    edge = poly.boundary
    vertices, lookup, indices, coast = [], {}, [], []
    def vertex(x,y):
        key = round(x*1e5),round(y*1e5)
        if key not in lookup:
            lookup[key] = len(vertices)//3
            # Conservative lower bound on distance to the outline in degrees.
            # Zero weight locks shared seams even when the Z axis rolls through the date line.
            distance = edge.distance(Point(x,y))*max(0,math.cos(math.radians(y)))
            vertices.extend((*key,round(10000*distance)))
        return lookup[key]
    for part in polygons(poly):
        x0,y0,x1,y1=part.bounds
        # The same grid on both sides of a boundary avoids T junctions.
        for y in range(math.floor(y0/4)*4,math.ceil(y1/4)*4,4):
            for x in range(math.floor(x0/4)*4,math.ceil(x1/4)*4,4):
                for cell in polygons(part.intersection(box(x,y,x+4,y+4))):
                    for t in constrained_delaunay_triangles(cell).geoms:
                        a,b,c=list(t.exterior.coords)[:3]
                        if (b[0]-a[0])*(c[1]-a[1]) < (b[1]-a[1])*(c[0]-a[0]): b,c=c,b
                        ia,ib,ic=(vertex(*p) for p in (a,b,c))
                        if len({ia,ib,ic})<3: continue
                        # Every microplate has material inside its rim, even when narrower than a grid cell.
                        if all(vertices[3*k+2] == 0 for k in (ia,ib,ic)):
                            # A planar centroid can fall outside a narrow spherical face.
                            lons,lats=np.radians(np.array([a,b,c])).T
                            mx,my,mz=np.array([np.cos(lats)*np.cos(lons),np.cos(lats)*np.sin(lons),np.sin(lats)]).sum(axis=1)
                            mid_lon=math.degrees(math.atan2(my,mx))
                            im=vertex(mid_lon,math.degrees(math.atan2(mz,math.hypot(mx,my))))
                            indices.extend([ia,ib,im,ib,ic,im,ic,ia,im])
                        else: indices.extend([ia,ib,ic])
        # Use the actual clipped surface edges for walls, including the same subdivisions.
    counts={}
    for a,b,c in zip(indices[::3],indices[1::3],indices[2::3]):
        for i,j in [(a,b),(b,c),(c,a)]:
            k=min(i,j),max(i,j)
            if k in counts: counts[k]=None
            else: counts[k]=(i,j)
    for pair in counts.values():
        if not pair: continue
        i,j=pair
        if abs(vertices[3*i])==abs(vertices[3*j])==18000000 or abs(vertices[3*i+1])==abs(vertices[3*j+1])==9000000:continue
        coast.extend(pair)
    assert indices and any(vertices[2::3]),code
    data[code]={"pole":poles[code],"vertices":vertices,"triangles":indices,"rim":coast,"weights":rotation_weights(vertices,indices,poles[code])}
(root/"mosaic.json").write_text(json.dumps(data,separators=(",",":"))+"\n")
print(len(data),"Platten,",sum(len(p["triangles"])//3 for p in data.values()),"Oberflächendreiecke")
