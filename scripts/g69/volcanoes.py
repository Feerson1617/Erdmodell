"""Offline orthophoto-style imagery and terrain for two measured geographic windows."""
from pathlib import Path
from io import BytesIO
from urllib.parse import urlencode
import sys,json
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'g6'))
from landscapes import get,root
out=root/'public/data/g69'
atlas=Image.new('RGB',(2048,1024))
catalog=[]
for i,(name,bounds) in enumerate([('Mauna Loa',[-156.15,18.98,-155.12,19.9]),('Zaōzan',[140.12,37.90,140.76,38.40])]):
    w,s,e,n=bounds
    url='https://tiles.maps.eox.at/wms?'+urlencode(dict(service='WMS',version='1.1.1',request='GetMap',layers='s2cloudless-2024',styles='',srs='EPSG:4326',bbox=','.join(map(str,bounds)),width=1024,height=1024,format='image/jpeg'))
    atlas.paste(Image.open(BytesIO(get(url))),(i*1024,0))
    lon,lat=np.meshgrid(np.linspace(w,e,161),np.linspace(n,s,161))
    z=9; xx=(lon+180)/360*256*2**z; yy=(1-np.arcsinh(np.tan(np.deg2rad(lat)))/np.pi)/2*256*2**z
    xs=range(int(xx.min())//256,int(xx.max())//256+1);ys=range(int(yy.min())//256,int(yy.max())//256+1)
    mosaic=np.zeros((256*len(ys),256*len(xs))); sources=[url]
    for y in ys:
        for x in xs:
            url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
            sources.append(url);a=np.asarray(Image.open(BytesIO(get(url))).convert('RGB'),dtype=float)
            j=(y-ys.start)*256;k=(x-xs.start)*256
            mosaic[j:j+256,k:k+256]=a[:,:,0]*256+a[:,:,1]+a[:,:,2]/256-32768
    heights=map_coordinates(mosaic,[yy-ys.start*256-.5,xx-xs.start*256-.5],order=1,mode='nearest')
    assert heights.max()>(4000 if i==0 else 1700)
    heights.round().astype('<i2').tofile(out/f'vent-{i}.i16')
    catalog.append(dict(name=name,bounds=bounds,sources=sources,grid=161,maxMetres=round(heights.max())))
atlas.save(out/'volcanoes.webp',quality=92)
(out/'sources.json').write_text(json.dumps(catalog,indent=2)+'\n')
