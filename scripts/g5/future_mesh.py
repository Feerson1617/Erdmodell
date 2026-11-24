"""Tessellate the published continent polygons once. Keep the four finite-rotation histories separate."""
from pathlib import Path
import sys,json,math,struct
from collections import defaultdict
import pygplates as pg, shapely
from shapely.geometry import Polygon,box
from time import time
src=Path(sys.argv[1])/'future'
out=Path(__file__).resolve().parents[2]/'public/data/g5/time'
features=pg.FeatureCollection(next(src.glob('Matthews*.gpml')))
pieces=defaultdict(list);wrap=pg.DateLineWrapper()
for f in features:
    pid=f.get_reconstruction_plate_id()
    for poly in wrap.wrap(f.get_geometry(),.7):
        g=shapely.make_valid(Polygon([(p.get_longitude(),p.get_latitude()) for p in poly.get_exterior_points()]))
        l,b,r,t=g.bounds
        for x in range(4*math.floor(l/4),math.ceil(r),4):
            for y in range(4*math.floor(b/4),math.ceil(t),4):
                tile=g.intersection(box(x,y,x+4,y+4))
                if tile.area<1e-7:continue
                for tri in shapely.constrained_delaunay_triangles(tile).geoms:
                    for lon,lat in list(tri.exterior.coords)[:3]:pieces[pid].append((round(lon*100),round(lat*100)))
index=[];raw=bytearray()
for pid,points in sorted(pieces.items()):
    index.append(dict(pid=pid,start=len(raw)//4,count=len(points)))
    for pair in points:raw.extend(struct.pack('<hh',*pair))
(out/'future.i16').write_bytes(raw)
models={}
for i,(name,end) in enumerate([('ultima',250),('novo',200),('aurica',250),('amasia',200)],1):
    rm=pg.RotationModel(next(src.glob(str(i)+'*.rot')));states=[]
    for year in range(end+1):
        state=[]
        for entry in index:
            pole,angle=rm.get_rotation(300-year,entry['pid']).get_euler_pole_and_angle();x,y,z=pole.to_xyz();s=math.sin(angle/2)
            state.append([round(v,7) for v in (y*s,z*s,x*s,math.cos(angle/2))])
        states.append(state)
    models[name]=states
(out/'future-rotations.json').write_text(json.dumps(dict(index=index,models=models),separators=(',',':')))
print(len(raw),len(index))
