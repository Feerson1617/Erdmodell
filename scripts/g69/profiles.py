"""Sample the landscape north of two east–west summit profiles."""
import json,math
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
root=Path(__file__).resolve().parents[2]
base=root/'public/data/g69'
atlas=np.asarray(Image.open(base/'volcanoes.webp').convert('RGB'))
rows=[]
for i,(meta,(lat,lon,width)) in enumerate(zip(json.loads((base/'sources.json').read_text()),[(19.475,-155.608,72),(38.144,140.44,20)])):
    w,s,e,n=meta['bounds'];a=np.linspace(-.5,.5,101);b=np.linspace(0,.35,36)
    x,z=np.meshgrid(lon+a*width/(111.195*math.cos(math.radians(lat))),lat+b*width/111.195)
    u=(x-w)/(e-w);v=(n-z)/(n-s)
    assert min(u.min(),v.min())>=0 and max(u.max(),v.max())<=1
    h=np.fromfile(base/f'vent-{i}.i16',dtype='<i2').astype(float).reshape(161,161)
    heights=map_coordinates(h,[v*160,u*160],order=1).round().astype(int)
    rgb=np.stack([map_coordinates(atlas[:,:,k],[v*1023,(u+i)*1023+i],order=1) for k in range(3)],axis=2)
    rows.append(dict(width=width,heights=heights.ravel().tolist(),rgb=rgb.tobytes().hex()))
(root/'src/seismology/volcano-profiles.json').write_text(json.dumps(rows,separators=(',',':')))
