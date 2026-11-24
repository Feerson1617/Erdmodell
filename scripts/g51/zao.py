"""Build a land-to-trench transect through the GVP summit at Zaozan."""
import math, sys, json, hashlib
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from io import BytesIO
import numpy as np
from scipy.ndimage import map_coordinates
from PIL import Image
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'scripts/g5'))
from terrain import sample,grid,cache
out=root/'public/data/g51/zao';out.mkdir(exist_ok=True)
volcano=[38.1439,140.4397];ang=math.radians(13);k=111.195
lat=volcano[0]-180*math.sin(ang)/k
lon=volcano[1]+180*math.cos(ang)/(k*math.cos(math.radians(lat)))
site=dict(name='Japan · Zaozan und Japangraben',lat=lat,lon=lon,strike=13,width=480)
sources=[]
for context,level,n,m,imw,imh in [(False,7,193,145,1152,864),(True,5,145,109,576,432)]:
    area=dict(site,width=site['width']*(4 if context else 1));lon_,lat_=grid(area,n,m);size=256*2**level
    h,tiles=sample((lon_+180)/360*size,(1-np.arcsinh(np.tan(np.deg2rad(lat_)))/np.pi)/2*size,256,'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+str(level)+'/{x}/{y}.png',True)
    sources.extend(u for x,y,u in tiles);h.tofile(out/('context.i16' if context else 'terrain.i16'))
    xx,yy=grid(area,imw,imh);rgb,tiles=sample((xx+180)/4.5*512,(90-yy)/4.5*512,512,'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/6/{y}/{x}.jpeg',False)
    sources.extend(u for x,y,u in tiles)
    if context:Image.fromarray(rgb).save(out/'context.webp',quality=84);continue
    west,south,east,north=xx.min(),yy.min(),xx.max(),yy.max()
    url='https://tiles.maps.eox.at/wms?'+urlencode(dict(service='WMS',version='1.1.1',request='GetMap',layers='s2cloudless-2024',styles='',srs='EPSG:4326',bbox=','.join('%.7f'%v for v in (west,south,east,north)),width=1600,height=1400,format='image/jpeg'))
    path=cache/hashlib.sha256(url.encode()).hexdigest()
    if not path.exists():path.write_bytes(urlopen(url,timeout=75).read())
    optical=np.asarray(Image.open(path).convert('RGB'));xy=[(north-yy)/(north-south)*1399,(xx-west)/(east-west)*1599]
    land=np.stack([map_coordinates(optical[:,:,i],xy,order=1,mode='nearest') for i in range(3)],2)
    mask=np.asarray(Image.fromarray(np.uint8(np.clip((h.astype(float)+10)/40,0,1)*255)).resize((imw,imh),Image.Resampling.BILINEAR))/255
    Image.fromarray(np.uint8(land*mask[:,:,None]+rgb*(1-mask[:,:,None]))).save(out/'surface.webp',quality=89)
    dz,dx=np.gradient(h.astype(float),area['width']*1000/(n-1));normal=np.stack([-dx*2.4,-dz*2.4,np.ones_like(dx)],2);normal/=np.linalg.norm(normal,axis=2,keepdims=True)
    Image.fromarray(np.uint8((normal*.5+.5)*255)).save(out/'normal.webp',lossless=True)
    Image.fromarray(np.uint8(108+123*mask)).resize((384,288)).save(out/'rough.webp',lossless=True);sources.append(url)
# Intersect the original directed Japan trench polyline with the transect.
trace=json.loads((root/'src/observatory/traces.json').read_text())['japan']['points']
def local(point):
    east=(point[0]-lon)*k*math.cos(math.radians(lat));north=(point[1]-lat)*k
    return ((east*math.cos(ang)-north*math.sin(ang))/40,(-east*math.sin(ang)-north*math.cos(ang))/40)
points=[local(p) for p in trace]
xs=[a[0]+(b[0]-a[0])*(-a[1])/(b[1]-a[1]) for a,b in zip(points,points[1:]) if a[1]*b[1]<0]
assert len(xs)==1 and 0<xs[0]<6,xs
site.update(vent=-4.5,trench=xs[0],volcano=volcano)
(root/'src/observatory/zao.json').write_text(json.dumps(site,indent=2,ensure_ascii=False)+'\n')
(out/'sources.json').write_text(json.dumps({u:hashlib.sha256((cache/hashlib.sha256(u.encode()).hexdigest()).read_bytes()).hexdigest() for u in sorted(set(sources))},indent=2)+'\n')
print(site)

