"""Compare independently served GPlates resolved polygons to the packaged boundary masks."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
from hashlib import sha256
from scipy.spatial import cKDTree
from PIL import Image
import numpy as np,json
root=Path(__file__).resolve().parents[2]
def cart(lon,lat):
    a,b=np.deg2rad(lon),np.deg2rad(lat)
    return np.stack([np.cos(b)*np.cos(a),np.cos(b)*np.sin(a),np.sin(b)],axis=-1)
def compare(t):
    url=f'https://gws.gplates.org/topology/plate_polygons/?model=MULLER2019&time={t}'
    with urlopen(url,timeout=90) as res:raw=res.read()
    fs=json.loads(raw)['features'];points=[]
    for f in fs:
        if f['properties'].get('type') not in ('gpml:TopologicalClosedPlateBoundary','gpml:TopologicalNetwork'):continue
        g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
        for poly in polys:
            points.extend((x,y) for x,y in poly[0] if abs(x)<179 and abs(y)<88)
    img=np.asarray(Image.open(root/f'public/data/g5/time/past-{t}.webp').convert('RGB'))
    ys,xs=np.where(img[:,:,1]>160);tree=cKDTree(cart((xs+.5)/1024*360-180,90-(ys+.5)/512*180));v=np.array(points)
    dist,_=tree.query(cart(v[:,0],v[:,1]));angle=np.rad2deg(2*np.arcsin(np.clip(dist/2,0,1)))
    return dict(time=t,url=url,sha256=sha256(raw).hexdigest(),vertices=len(points),matchedWithinOneDegree=round(float(np.mean(angle<=1)),3),medianDegrees=round(float(np.median(angle)),3),p95Degrees=round(float(np.quantile(angle,.95)),3))
with ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(compare,[0,50,100,150,200,250]))
assert all(r['matchedWithinOneDegree']>.7 for r in rows),rows
(root/'docs/g5-referenz.json').write_text(json.dumps(rows,indent=2)+'\n')
