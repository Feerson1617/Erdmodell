"""Build time-valid rigid continents from Müller 2019 and static Davies scenario lines."""
from pathlib import Path
import sys,math,struct,json,itertools,hashlib
import numpy as np,pygplates as pg,shapely
from shapely.geometry import Polygon,box
root=Path(__file__).resolve().parents[2];out=root/'public/data/g51';src=Path(sys.argv[1])
def quant(lon,lat):return (round(lon*100),round(lat*100))
features=list(pg.FeatureCollection(next(src.rglob('*ContPolygons*.shp'))))
rotation=pg.RotationModel(next(src.rglob('*CombinedRotations.rot')))
pids=sorted({f.get_reconstruction_plate_id() for f in features})
wrap=pg.DateLineWrapper();index=[];binary=bytearray()
for f in features:
    begin,end=f.get_valid_time()
    if end>250 or begin<0:continue
    assert f.get_reconstruction_method()=='ByPlateId' and f.get_geometry_import_time()==0
    start=len(binary)//4
    for part in wrap.wrap(f.get_geometry(),1):
        def pts(ring):return [(v.get_longitude(),v.get_latitude()) for v in ring]
        rings=[pts(part.get_interior_points(j)) for j in range(part.get_number_of_interior_rings())]
        poly=shapely.make_valid(Polygon(pts(part.get_exterior_points()),rings)).simplify(.075,preserve_topology=True)
        if poly.is_empty:continue
        l,b,r,t=poly.bounds
        for x in range(5*math.floor(l/5),math.ceil(r),5):
            for y in range(5*math.floor(b/5),math.ceil(t),5):
                tile=poly.intersection(box(x,y,x+5,y+5))
                if tile.area<1e-7:continue
                for tri in shapely.constrained_delaunay_triangles(tile).geoms:
                    for lon,lat in list(tri.exterior.coords)[:3]:binary.extend(struct.pack('<hh',*quant(lon,lat)))
    if len(binary)//4>start:index.append([start,len(binary)//4-start,pids.index(f.get_reconstruction_plate_id()),max(0,end),min(250,begin)])
(out/'historic.i16').write_bytes(binary)
rotations=np.empty((251,len(pids),4),dtype='<f4')
for age in range(251):
    for k,pid in enumerate(pids):
        pole,angle=rotation.get_rotation(age,pid).get_euler_pole_and_angle();x,y,z=pole.to_xyz();s=math.sin(angle/2)
        rotations[age,k]=(y*s,z*s,x*s,math.cos(angle/2))
rotations.tofile(out/'historic-rotations.f32')
(out/'historic.json').write_text(json.dumps(dict(pids=pids,features=index),separators=(',',':')))
print(len(index),len(binary),rotations.nbytes,flush=True)
lines={}
for n,model in enumerate(['ultima','novo','aurica','amasia'],1):
    arr=[];rm=pg.RotationModel(next((src/'future').glob(str(n)+'*.rot')))
    for path in (src/'future').glob(str(n)+'*.gpml'):
        for f in pg.FeatureCollection(path):
            begin,end=f.get_valid_time();a=max(0,300-begin);b=min(250 if n in [1,3] else 200,300-end)
            if a>b:continue
            pid=f.get_reconstruction_plate_id()
            middle=rm.get_rotation(300-(a+b)/2,pid)
            for age in [a+.001,(a+b)/2,b-.001]:
                delta=rm.get_rotation(300-age,pid)*middle.get_inverse()
                assert abs(delta.get_euler_pole_and_angle()[1])<1e-5
            for g in f.get_geometries():
                arr.append([a,b,0 if 'Ridges' in path.name else 1,[[round(k,2) for k in v.to_lat_lon()] for v in (middle*g).to_tessellated(math.radians(1.8)).get_points()]])
    lines[model]=arr
(out/'future-lines.json').write_text(json.dumps(lines,separators=(',',':')))
print({k:len(v) for k,v in lines.items()})

