"""Pack freely reusable photographic detail into two locally streamed, guttered atlases."""
from pathlib import Path
from io import BytesIO
from hashlib import sha256,md5
from urllib.request import urlopen,Request
from concurrent.futures import ThreadPoolExecutor
import json,numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[2]
out=root/'public/data/g6';out.mkdir(exist_ok=True,parents=True)
names=['withered_grass','dry_ground_rocks','lichen_rock','dark_rock','rock_face_03','sandstone_cracks','brown_mud_dry','forest_ground_04']
def request(url):
    with urlopen(Request(url,headers={'User-Agent':'GeoRisiko educational texture preparation'}),timeout=45) as r:return r.read()
def row(name):
    files=json.loads(request('https://api.polyhaven.com/files/'+name));refs={}
    def image(kind):
        part=files[kind]['1k'];record=part.get('jpg') or part['png'];raw=request(record['url'])
        assert md5(raw).hexdigest()==record['md5']
        refs[kind]=dict(url=record['url'],sha256=sha256(raw).hexdigest())
        return np.asarray(Image.open(BytesIO(raw)).convert('RGB').resize((1016,1016),Image.Resampling.LANCZOS))
    color=image('Diffuse');normal=image('nor_gl').copy();normal[:,:,2]=image('Rough')[:,:,0]
    def gutter(data):return Image.fromarray(np.pad(data,((4,4),(4,4),(0,0)),mode='wrap'))
    return gutter(color),gutter(normal),dict(name=name,license='CC0-1.0',source='https://polyhaven.com/a/'+name,files=refs,mean=np.mean(color,axis=(0,1)).round(1).tolist())
a=Image.new('RGB',(4096,2048));n=a.copy();records=[]
with ThreadPoolExecutor(max_workers=3) as pool:
    for k,(color,normal,meta) in enumerate(pool.map(row,names)):
        pos=(k%4*1024,k//4*1024);a.paste(color,pos);n.paste(normal,pos);records.append(meta)
a.save(out/'facies.webp',quality=88,method=5);n.save(out/'facies-relief.webp',quality=94,method=5)
(out/'facies-source.json').write_text(json.dumps(records,indent=2)+'\n')
