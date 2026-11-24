"""Offline authoring tool. Python 3, pyGPlates 1.x, Pillow, NumPy. See docs/g5-quellen.md."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import pygplates as pg

W,H=1024,512
root=Path(__file__).resolve().parents[2]
out=root/'public/data/g5/time'
out.mkdir(parents=True,exist_ok=True)
wrap=pg.DateLineWrapper()
def pixels(points):
    return [((p.get_longitude()+180)*W/360,(90-p.get_latitude())*H/180) for p in points]
def generate(source,scenario):
    if scenario=='past':
        source=source/'past'
        rot=pg.RotationModel(next(source.rglob('*CombinedRotations.rot')))
        land=pg.FeatureCollection(next(source.rglob('*ContPolygons*.shp')))
        topo=pg.FeatureCollection(next(source.rglob('*DeformingNetworks.gpmlz')))
        maximum=250
    else:
        source=source/'future'
        index,maximum={'ultima':('1',250),'novo':('2',200),'aurica':('3',250),'amasia':('4',200)}[scenario]
        rot=pg.RotationModel(next(source.glob(index+'*.rot')))
        land=pg.FeatureCollection(next(source.glob('Matthews*.gpml')))
    counts=[]
    for age in range(0,maximum+1,5):
        time=age if scenario=='past' else 300-age
        result=[]
        pg.reconstruct(land,rot,result,time,anchor_plate_id=0)
        mask=Image.new('L',(W,H))
        draw=ImageDraw.Draw(mask)
        for feature in result:
            for part in wrap.wrap(feature.get_reconstructed_geometry(),.45):
                ring=pixels(part.get_exterior_points())
                if len(ring)>=3:draw.polygon(ring,fill=255)
        edges=Image.new('L',(W,H));zones=Image.new('L',(W,H));nplates=0;nnet=0
        if scenario=='past':
            resolved=[];sections=[]
            pg.resolve_topologies(topo,rot,resolved,time,sections,anchor_plate_id=0,resolve_topology_types=pg.ResolveTopologyType.boundary|pg.ResolveTopologyType.network)
            pen=ImageDraw.Draw(edges)
            for s in sections:
                for segment in s.get_shared_sub_segments():
                    for part in wrap.wrap(segment.get_resolved_geometry(),.45):
                        pts=pixels(part.get_points())
                        if len(pts)>1:pen.line(pts,fill=255)
            for geometry in resolved:
                if isinstance(geometry,pg.ResolvedTopologicalNetwork):
                    nnet+=1
                    for part in wrap.wrap(geometry.get_resolved_boundary(),.45):
                        ring=pixels(part.get_exterior_points())
                        if len(ring)>=3:ImageDraw.Draw(zones).polygon(ring,fill=255)
            nplates=len(resolved)-nnet
            assert nplates>=5
        area=float(np.mean(np.asarray(mask)>0))
        assert .12<area<.83,(scenario,age,area)
        img=Image.merge('RGB',(mask,edges,zones))
        path=out/f'{scenario}-{age}.webp'
        img.save(path,'WEBP',lossless=True,method=3)
        counts.append(dict(age=age,continentalFragments=len(result),resolvedPlatePolygons=nplates,deformingNetworks=nnet,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    (out/f'{scenario}.json').write_text(json.dumps(counts,separators=(',',':')))
    print(scenario,len(counts),flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('scenario',choices=['past','ultima','novo','aurica','amasia']);args=p.parse_args();generate(args.source,args.scenario)
