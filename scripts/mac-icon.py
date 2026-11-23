"""Render the Finder icon from the bundled world map and a concentric geological section."""
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
size = 1024
y, x = np.mgrid[:size,:size].astype(float)
x, y = (x-511.5)/512, (511.5-y)/512
# Squircle tile, lit slate and brass limb; source texture shares the model's geography.
tile = np.maximum(abs(x)-.62,0)**2 + np.maximum(abs(y)-.62,0)**2
alpha = np.clip((.284**2-tile)*1800,0,1)
back = np.array([15,30,36]) + ((1+y-x)*6)[:,:,None]
sx, sy = (x-.01)/.745, (y-.014)/.745
r = np.hypot(sx,sy)
sz = np.sqrt(np.maximum(0,1-r*r))
lat0, lon0 = np.radians(24), np.radians(12)
lat = np.arcsin(np.clip(sy*np.cos(lat0)+sz*np.sin(lat0),-1,1))
lon = lon0+np.arctan2(sx, sz*np.cos(lat0)-sy*np.sin(lat0))
tex = np.asarray(Image.open(root/'public/data/earth.webp').convert('RGB'),dtype=float)
h,w=tex.shape[:2]
rgb=tex[np.clip(((.5-lat/np.pi)*h).astype(int),0,h-1),(((lon/np.pi/2+.5)*w).astype(int))%w]
light=np.clip(.48+.59*(-.44*sx+.5*sy+.74*sz),.32,1.2)
globe=rgb*light[:,:,None]+np.array([16,31,35])*(1-sz[:,:,None])**4
cut = (sx>0)&(sy<.39*sx)
band=np.where((r<.24)[:,:,None],[251,191,105],np.where((r<.53)[:,:,None],[215,105,53],np.where((r<.955)[:,:,None],[157,79,53],[208,174,121])))
stone=1+.035*np.sin(34*r+4*sx)*np.cos(29*sy)+.018*np.sin(111*r+5*sy)
globe=np.where(cut[:,:,None],band*stone[:,:,None]*(.99-.19*sx+.12*sy)[:,:,None],globe)
rim=np.clip(1-abs(r-.999)*155,0,1)[:,:,None]
globe=globe*(1-rim)+np.array([153,174,163])*rim
blend=np.clip((1.003-r)*250,0,1)[:,:,None]
out=np.dstack([back*(1-blend)+globe*blend,255*alpha])
Image.fromarray(np.clip(out,0,255).astype('uint8')).save(root/'desktop/GeoRisiko.png',optimize=True)
