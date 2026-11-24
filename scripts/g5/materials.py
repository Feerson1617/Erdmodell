"""Produce region-aligned Sentinel-2 surfaces, terrain detail normals and roughness."""
from terrain import grid,sample,sites,out
from concurrent.futures import ThreadPoolExecutor
from scipy.ndimage import map_coordinates,gaussian_filter
from PIL import Image
from io import BytesIO
from hashlib import sha256
from urllib.request import urlopen
from urllib.parse import urlencode
import numpy as np,json
def build(entry):
    name,s=entry
    lon,lat=grid(s,1152,864);w,b,e,n=lon.min(),lat.min(),lon.max(),lat.max()
    url='https://tiles.maps.eox.at/wms?'+urlencode(dict(service='WMS',version='1.1.1',request='GetMap',layers='s2cloudless-2024',styles='',srs='EPSG:4326',bbox=','.join('%.7f'%v for v in (w,b,e,n)),width=1600,height=1400,format='image/jpeg'))
    for attempt in range(3):
        try:
            with urlopen(url,timeout=85) as r:raw=r.read()
            img=np.asarray(Image.open(BytesIO(raw)).convert('RGB'));assert img.shape==(1400,1600,3);break
        except Exception:
            if attempt==2:raise
    xy=[(n-lat)/(n-b)*1399,(lon-w)/(e-w)*1599]
    rgb=np.stack([map_coordinates(img[:,:,i],xy,order=1,mode='nearest') for i in range(3)],2)
    old=np.asarray(Image.open(out/(name+'.webp')).convert('RGB').resize((1152,864)))
    lon,lat=grid(s,385,289);level={'san':10,'island':9,'rift':9,'himalaya':8,'japan':7,'hawaii':7}[name]
    side=256*2**level
    h,_=sample((lon+180)/360*side,(1-np.arcsinh(np.tan(np.deg2rad(lat)))/np.pi)/2*side,256,'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+str(level)+'/{x}/{y}.png',True)
    water=np.array(Image.fromarray(np.uint8(np.clip((3-h.astype(float))/12,0,1)*255)).resize((1152,864),Image.Resampling.BILINEAR))/255
    mix=np.maximum(water,np.max(rgb,axis=2)<8)[:,:,None]
    img=Image.fromarray(np.uint8(rgb*(1-mix)+old*mix))
    img.save(out/(name+'-surface.webp'),quality=87,method=6)
    fine=h.astype(float)-gaussian_filter(h.astype(float),1.4);dz,dx=np.gradient(fine/(s['width']*1000/384))
    norm=np.stack([-dx*2.4,dz*2.4,np.ones_like(dx)],2);norm/=np.linalg.norm(norm,axis=2)[:,:,None]
    Image.fromarray(np.uint8((norm*.5+.5)*255)).save(out/(name+'-normal.webp'),lossless=True)
    return dict(site=name,url=url,sha256=sha256(raw).hexdigest(),license='CC BY-NC-SA 4.0',size=[1152,864])
with ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(build,sites.items()))
(out/'surface-sources.json').write_text(json.dumps(rows,separators=(',',':')))
