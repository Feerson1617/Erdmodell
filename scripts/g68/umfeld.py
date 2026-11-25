"""Sample Copernicus GLO-30 and official RLP orthophotos at identical geographic coordinates."""
import math,json,urllib.request,sys
from pathlib import Path
from PIL import Image
cache=Path(sys.argv[1]);cache.mkdir(parents=True,exist_ok=True)
dest=Path('public/data/vulkaneifel');dest.mkdir(exist_ok=True)
def fetch(url,path):
 if not path.exists():urllib.request.urlretrieve(url,path)
 return Image.open(path)
tiles={}
for e in (6,7):
 key=f'Copernicus_DSM_COG_10_N50_00_E{e:03}_00_DEM'
 tiles[e]=fetch(f'https://copernicus-dem-30m.s3.amazonaws.com/{key}/{key}.tif',cache/f'{e:03}.tif')
for name,box,n,res in [('umfeld',(6.969,50.2028,6.997,50.2242),101,1600)]:
 w,s,e,north=box
 metresX=(e-w)*111320*math.cos(math.radians((s+north)/2));metresZ=(north-s)*111320
 h=round(res*metresZ/metresX)
 url='https://geo4.service24.rlp.de/wms/rp_dop20.fcgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=rp_dop20&STYLES=&FORMAT=image/jpeg&SRS=EPSG:4326&BBOX='+','.join(map(str,box))+f'&WIDTH={res}&HEIGHT={h}'
 fetch(url,cache/(name+'-dop.jpg')).convert('RGB').save(dest/(name+'.webp'),quality=89)
 vals=[]
 for j in range(n):
  for i in range(n):
   lon=w+(e-w)*i/(n-1);lat=north-(north-s)*j/(n-1);tile=tiles[int(lon)]
   x=round((lon-int(lon))*tile.width);y=round((51-lat)*tile.height)
   vals.append(round(tile.getpixel((x,y))))
 Path(f'src/seismology/{name}-dsm.json').write_text(json.dumps(dict(box=box,n=n,width=metresX,depth=metresZ,values=vals),separators=(',',':')))
