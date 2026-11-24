"""Derive a relief-normal and ocean mask from the project's measured ETOPO grid."""
from pathlib import Path
from PIL import Image
import numpy as np
root=Path(__file__).resolve().parents[2]
v=np.fromfile(root/'public/data/relief.i16','<i2').reshape(361,721).astype(float)
lat=np.abs(np.cos(np.deg2rad(np.linspace(90,-90,361))))[:,None].clip(.2)
sx=(np.roll(v,-1,1)-np.roll(v,1,1))/(111195*lat);sy=np.gradient(v,axis=0)/55597
img=np.stack([np.clip(.5+sx*2.8,0,1),np.clip(.5+sy*2.8,0,1),np.clip(-v/5800,0,1)],2)
Image.fromarray(np.uint8(img*255)).save(root/'public/data/g5/earth-material.webp',lossless=True)
