"""Sample a strike-aligned local tangent grid, with actual terrain and GIBS surface colour."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
from PIL import Image
from io import BytesIO
from hashlib import sha256
import json, math, numpy as np
from scipy.ndimage import map_coordinates
root=Path(__file__).resolve().parents[2]; out=root/'public/data/g5/terrain'
cache=Path('/tmp/georisiko-g5-tiles');cache.mkdir(exist_ok=True);out.mkdir(parents=True,exist_ok=True)
sites=json.loads((root/'src/observatory/sites.json').read_text())
def tile(url):
    key=cache/sha256(url.encode()).hexdigest()
    if not key.exists():
        for i in range(3):
            try:
                with urlopen(url,timeout=50) as r:data=r.read()
                Image.open(BytesIO(data)).verify()
                key.write_bytes(data);break
            except Exception:
                if i==2:raise
    return np.asarray(Image.open(key).convert('RGB'))
def sample(xx,yy,size,url,height):
    x0,x1=int(xx.min())//size,int(xx.max())//size
    y0,y1=int(yy.min())//size,int(yy.max())//size
    canvas=np.zeros(((y1-y0+1)*size,(x1-x0+1)*size,3),dtype='uint8')
    coords=[(x,y,url.format(x=x,y=y)) for x in range(x0,x1+1) for y in range(y0,y1+1)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for (x,y,u),pixels in zip(coords,pool.map(tile,[c[2] for c in coords])):
            canvas[(y-y0)*size:(y-y0+1)*size,(x-x0)*size:(x-x0+1)*size]=pixels
    xy=[yy-y0*size-.5,xx-x0*size-.5]
    if height:
        elev=canvas[:,:,0].astype(float)*256+canvas[:,:,1]+canvas[:,:,2]/256-32768
        return map_coordinates(elev,xy,order=1,mode='nearest').round().astype('<i2'),coords
    return np.stack([map_coordinates(canvas[:,:,i],xy,order=1,mode='nearest') for i in range(3)],2),coords
def grid(s,n,m):
    x,z=np.meshgrid(np.linspace(-.5,.5,n),np.linspace(-.375,.375,m))
    a=np.deg2rad(s['strike']);east=x*np.cos(a)-z*np.sin(a);north=-x*np.sin(a)-z*np.cos(a)
    return s['lon']+s['width']*east/(111.195*np.cos(np.deg2rad(s['lat']))),s['lat']+s['width']*north/111.195
def build(item):
    name,s=item
    lon,lat=grid(s,193,145);level={'san':10,'island':9,'rift':9,'himalaya':8,'japan':7,'hawaii':7}[name]
    side=256*2**level
    dem,tiles=sample((lon+180)/360*side,(1-np.arcsinh(np.tan(np.deg2rad(lat)))/np.pi)/2*side,256,'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+str(level)+'/{x}/{y}.png',True)
    (out/(name+'.i16')).write_bytes(dem.tobytes())
    lon,lat=grid(s,768,576)
    rgb,colors=sample((lon+180)/4.5*512,(90-lat)/4.5*512,512,'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/6/{y}/{x}.jpeg',False)
    Image.fromarray(rgb).save(out/(name+'.webp'),quality=88)
    return dict(site=name,grid=[193,145],bounds=s,meters=[int(dem.min()),int(dem.max())],tiles=[dict(url=u,sha256=sha256((cache/sha256(u.encode()).hexdigest()).read_bytes()).hexdigest()) for _,_,u in tiles+colors])
if __name__=="__main__":
    with ThreadPoolExecutor(max_workers=2) as workers:result=list(workers.map(build,sites.items()))
    (out/'provenance.json').write_text(json.dumps(result,separators=(',',':')))
