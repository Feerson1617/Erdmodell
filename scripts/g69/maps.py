"""Reproject the archived GIBS mosaic and obtain a consistent North European image."""
from pathlib import Path
import hashlib, json, sys
from io import BytesIO
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'g6'))
from landscapes import get, root

base=root/'public/data'
sources=json.loads((base/'g6/earth-source.json').read_text())['sources']
image=Image.new('RGB',(10240,5120))
for url,digest in sources:
    raw=get(url)
    assert hashlib.sha256(raw).hexdigest()==digest
    y,x=map(int,url.removesuffix('.jpeg').split('/')[-2:])
    image.paste(Image.open(BytesIO(raw)),(x*512,y*512))
image.resize((8192,4096),Image.Resampling.LANCZOS).save(base/'g6/earth-day.webp',quality=90,method=5)
image.close()
def region(ij):
    x,y=ij
    bounds=(4+x*2.25,59-(y+1)*2,4+(x+1)*2.25,59-y*2)
    url='https://tiles.maps.eox.at/wms?'+urlencode(dict(service='WMS',version='1.1.1',request='GetMap',layers='s2cloudless-2024',styles='',srs='EPSG:4326',bbox=','.join(map(str,bounds)),width=1024,height=1024,format='image/jpeg'))
    raw=get(url)
    tile=Image.open(BytesIO(raw)).convert('RGB')
    assert tile.size==(1024,1024) and max(tile.convert('L').getextrema())>30
    return x,y,tile,[url,hashlib.sha256(raw).hexdigest()]
image=Image.new('RGB',(4096,4096))
records=[]
with ThreadPoolExecutor(4) as pool:
    for x,y,tile,source in pool.map(region,[(x,y) for y in range(4) for x in range(4)]):
        image.paste(tile,(x*1024,y*1024))
        records.append(source)
image.save(base/'north-europe.webp',quality=89,method=5)
(base/'g6/north-europe-source.json').write_text(json.dumps(records,indent=2)+'\n')
