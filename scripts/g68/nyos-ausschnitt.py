"""Produce a georeferenced classroom crop from the existing licensed Nyos assets."""
from array import array
from pathlib import Path
from PIL import Image
import json, math, sys
root=Path("public/data/nyos")
meta=json.loads((root/"landscape.json").read_text())
w,s,e,n=meta["bounds"]
box=(10.281,6.423,10.316,6.455)
west,south,east,north=box
img=Image.open(root/"surface.webp")
crop=((west-w)/(e-w)*img.width,(n-north)/(n-s)*img.height,(east-w)/(e-w)*img.width,(n-south)/(n-s)*img.height)
img.crop(tuple(round(x) for x in crop)).save("public/data/vulkaneifel/nyos.webp",quality=92)
values=array("h");values.frombytes((root/meta["heightFile"]).read_bytes())
if sys.byteorder!="little":values.byteswap()
cols,rows=meta["width"],meta["height"]
grid=81;heights=[]
for j in range(grid):
 for i in range(grid):
  lon=west+(east-west)*i/(grid-1);lat=north-(north-south)*j/(grid-1)
  heights.append(values[round((n-lat)/(n-s)*(rows-1))*cols+round((lon-w)/(e-w)*(cols-1))])
terrain=dict(box=box,n=grid,width=(east-west)*111320*math.cos(math.radians((north+south)/2)),depth=(north-south)*111320,values=heights)
Path("src/seismology/nyos-crop.json").write_text(json.dumps(terrain,separators=(",",":")))
