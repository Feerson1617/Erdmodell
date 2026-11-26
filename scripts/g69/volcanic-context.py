"""Intermediate scale between the world mosaic and the two summit windows."""
from pathlib import Path
from io import BytesIO
import hashlib,json,sys
from urllib.parse import urlencode
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'g6'))
from landscapes import get,root
atlas=Image.new('RGB',(2048,1024))
sources=[]
for i,bounds in enumerate([[-157,18.3,-154.4,20.8],[138.8,36.7,142.1,39.6]]):
    url='https://tiles.maps.eox.at/wms?'+urlencode(dict(service='WMS',version='1.1.1',request='GetMap',layers='s2cloudless-2024',styles='',srs='EPSG:4326',bbox=','.join(map(str,bounds)),width=1024,height=1024,format='image/jpeg'))
    raw=get(url)
    tile=Image.open(BytesIO(raw)).convert('RGB')
    assert tile.size==(1024,1024) and tile.convert('L').getextrema()[1]>100
    atlas.paste(tile,(i*1024,0))
    sources.append(dict(bounds=bounds,url=url,sha256=hashlib.sha256(raw).hexdigest()))
out=root/'public/data/g69'
atlas.save(out/'volcano-context.webp',quality=89)
(out/'volcano-context.json').write_text(json.dumps(sources,indent=2)+'\n')
