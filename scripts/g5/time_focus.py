from pathlib import Path
from PIL import Image
import numpy as np,json
root=Path(__file__).resolve().parents[2];out=root/'public/data/g5/time'
lat,lon=np.mgrid[0:512,0:1024].astype(float);lat=np.deg2rad(90-(lat+.5)*180/512);lon=np.deg2rad((lon+.5)*360/1024-180)
def center(p):
    mask=np.asarray(Image.open(p).convert('RGB'))[:,:,0]/255*np.cos(lat)
    y=np.sum(mask*np.sin(lat));x=np.sum(mask*np.cos(lat)*np.sin(lon));z=np.sum(mask*np.cos(lat)*np.cos(lon))
    return [round(float(np.rad2deg(np.arctan2(y,np.hypot(x,z)))),2),round(float(np.rad2deg(np.arctan2(x,z))),2)]
data={}
for name in ['past','ultima','novo','aurica','amasia']:
    data[name]=[center(out/f'{name}-{age}.webp') for age in range(0,251,5) if (out/f'{name}-{age}.webp').exists()]
(root/'src/observatory/time-focus.json').write_text(json.dumps(data,separators=(',',':')))
