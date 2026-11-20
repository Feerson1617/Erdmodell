"""Build the offline spherical mesh with Shapely 2.1, from the pinned PB2002 GIS and pole files."""
import hashlib, json, math, sys
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
                            im=vertex(t.centroid.x,t.centroid.y)
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
    data[code]={"pole":poles[code],"vertices":vertices,"triangles":indices,"rim":coast}
(root/"mosaic.json").write_text(json.dumps(data,separators=(",",":"))+"\n")
print(len(data),"Platten,",sum(len(p["triangles"])//3 for p in data.values()),"Oberflächendreiecke")
