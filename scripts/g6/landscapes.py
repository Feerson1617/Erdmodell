"""Prepare georeferenced display assets. Model elevations and solver inputs stay in G5."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
import json, sys, time, os
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, gaussian_filter, shift

root=Path(__file__).resolve().parents[2]
out=root/'public/data/g6'
out.mkdir(parents=True,exist_ok=True)
cache=Path('/tmp/georisiko-g5-tiles')
cache.mkdir(exist_ok=True)
sites=json.loads((root/'src/observatory/sites.json').read_text())
sites['zao']={**sites['japan'],**json.loads((root/'src/observatory/zao.json').read_text())}
def get(url):
    key=cache/sha256(url.encode()).hexdigest()
    if not key.exists():
        for attempt in range(3):
            try:
                with urlopen(Request(url,headers={'User-Agent':'GeoRisiko offline educational asset build'}),timeout=40) as response:data=response.read()
                Image.open(BytesIO(data)).verify()
                key.write_bytes(data)
                break
            except Exception:
                if attempt==2:raise
                time.sleep(1)
    return key.read_bytes()
def grid(s,n):
    x,z=np.meshgrid(np.linspace(-.5,.5,n),np.linspace(-.375,.375,n*3//4))
    a=np.deg2rad(s['strike']);east=x*np.cos(a)-z*np.sin(a);north=-x*np.sin(a)-z*np.cos(a)
    return s['lon']+s['width']*east/(111.195*np.cos(np.deg2rad(s['lat']))),s['lat']+s['width']*north/111.195
def relief(name,s):
    lon,lat=grid(s,769);level={'san':11,'island':10,'rift':10,'himalaya':9,'japan':8,'hawaii':8,'zao':7}[name]
    side=256*2**level;xx=(lon+180)/360*side;yy=(1-np.arcsinh(np.tan(np.deg2rad(lat)))/np.pi)/2*side
    x0,x1=int(xx.min())//256,int(xx.max())//256;y0,y1=int(yy.min())//256,int(yy.max())//256
    mosaic=np.zeros(((y1-y0+1)*256,(x1-x0+1)*256))
    coords=[(x,y,'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+f'{level}/{x}/{y}.png') for x in range(x0,x1+1) for y in range(y0,y1+1)]
    sources=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for (x,y,url),raw in zip(coords,pool.map(get,[r[2] for r in coords])):
            pix=np.array(Image.open(BytesIO(raw)).convert('RGB'),dtype=float)
            mosaic[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=pix[:,:,0]*256+pix[:,:,1]+pix[:,:,2]/256-32768
            sources.append([url,sha256(raw).hexdigest()])
    h=map_coordinates(mosaic,[yy-y0*256-.5,xx-x0*256-.5],order=1,mode='nearest');pitch=s['width']*1000/768
    dz,dx=np.gradient(h/pitch);grad=np.stack([-dx*1.95,dz*1.95,np.ones_like(dx)],axis=2)
    grad/=np.linalg.norm(grad,axis=2)[:,:,None]
    horizon=np.zeros_like(h)
    for sample in [2,5,10,20,42,80]:
        up=shift(h,(-sample*.38,sample*.92),order=1,mode='nearest',prefilter=False)
        horizon=np.maximum(horizon,(up-h)/(pitch*sample))
    enc=np.stack([grad[:,:,0]*.5+.5,grad[:,:,1]*.5+.5,np.clip(1.-.52*horizon-.18*np.maximum(0,(gaussian_filter(h,4)-h)/pitch),.38,1)],2)
    Image.fromarray(np.uint8(np.clip(enc,0,1)*255)).save(out/(name+'-relief.webp'),lossless=True)
    return h,sources
def imagery(name,s,h,context=False):
    lon,lat=grid(s,3072);w,b,e,n=lon.min(),lat.min(),lon.max(),lat.max()
    def tile(ij):
        i,j=ij
        bbox=','.join('%.8f'%v for v in (w+(e-w)*i/4,n-(n-b)*(j+1)/4,w+(e-w)*(i+1)/4,n-(n-b)*j/4))
        if name=='san' and os.environ.get('NAIP_EXPORT'):
            url='https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage?'+urlencode(dict(bbox=bbox,bboxSR=4326,imageSR=4326,size='900,850',format='jpg',adjustAspectRatio='false',f='image'))
        else:
            url='https://tiles.maps.eox.at/wms?'+urlencode(dict(service='WMS',version='1.1.1',request='GetMap',layers='s2cloudless-2024',styles='',srs='EPSG:4326',bbox=bbox,width=900,height=850,format='image/jpeg'))
        raw=get(url)
        return i,j,np.asarray(Image.open(BytesIO(raw)).convert('RGB')),[url,sha256(raw).hexdigest()]
    im=np.zeros((3400,3600,3),dtype=np.uint8);sources=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for i,j,img,source in pool.map(tile,[(i,j) for i in range(4) for j in range(4)]):
            im[j*850:(j+1)*850,i*900:(i+1)*900]=img
            sources.append(source)
    sh,sw=im.shape[:2];xy=[(n-lat)/(n-b)*(sh-1),(lon-w)/(e-w)*(sw-1)]
    rgb=np.stack([map_coordinates(im[:,:,i],xy,order=1,mode='nearest') for i in range(3)],2)
    assert rgb.std()>6,(name,'empty image')
    if name!='san' and not context:
        old=np.asarray(Image.open(root/f'public/data/g5/terrain/{name}.webp').convert('RGB').resize((3072,2304),Image.Resampling.BICUBIC))
        wet=np.asarray(Image.fromarray(np.uint8(np.clip((3-h)/12,0,1)*255)).resize((3072,2304),Image.Resampling.BILINEAR))/255
        mix=np.maximum(wet,np.max(rgb,axis=2)<8)[:,:,None];rgb=np.uint8(rgb*(1-mix)+old*mix)
    Image.fromarray(rgb).save(out/(name+('-context.webp' if context else '-surface.webp')),quality=90,method=5)
    return sources
def global_image():
    coords=[(x,y,f'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_NextGeneration/default/500m/4/{y}/{x}.jpeg') for y in range(10) for x in range(20)]
    globe=Image.new('RGB',(10240,5120));sources=[]
    with ThreadPoolExecutor(max_workers=7) as pool:
        for (x,y,url),raw in zip(coords,pool.map(get,[r[2] for r in coords])):
            globe.paste(Image.open(BytesIO(raw)),(512*x,512*y));sources.append([url,sha256(raw).hexdigest()])
    globe.resize((6144,3072),Image.Resampling.LANCZOS).save(out/'earth-day.webp',quality=90,method=5)
    return sources
for name in sys.argv[1:]:
    if name.endswith('-context'):
        site=name.split('-')[0];sources=imagery(site,dict(sites[site],width=4*sites[site]['width']),None,True)
    elif name=='earth': sources=global_image()
    else:
        h,sources=relief(name,sites[name])
        if name in ['san','japan','island']:sources.extend(imagery(name,sites[name],h))
    (out/(name+'-source.json')).write_text(json.dumps(dict(region=name,area=sites.get(name,'global'),sources=sources),separators=(',',':')))
    print(name,flush=True)
