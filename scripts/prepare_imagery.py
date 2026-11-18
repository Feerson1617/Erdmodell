"""Prepare licensed WMS 1.1.1 imagery for offline use. Inputs and extents in source catalogue."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import numpy as np, sys, random
out=Path('public/data')
def tone(im):
    im=ImageEnhance.Color(im).enhance(.85)
    a=np.asarray(im,dtype=float)
    return Image.fromarray(np.uint8((a*[.93,1.02,.89]+[6,8,3]).clip(0,255)))
full=Image.open(sys.argv[1]).convert('RGB')
mask=Image.fromarray(np.uint8(np.min(np.asarray(full),axis=2)<238)*255)
mask=mask.filter(ImageFilter.MinFilter(15)).filter(ImageFilter.GaussianBlur(12))
base=Image.open(out/'hooge.webp').resize(full.size)
full=Image.composite(tone(full),base,mask)
full.save(out/'hooge-air.webp',quality=85)
detail=tone(Image.open(sys.argv[2]).convert('RGB'))
detail.save(out/'hanswarft.webp',quality=88)
styled=full.filter(ImageFilter.MedianFilter(5)).resize(base.size)
mix=Image.blend(base,styled,.43).quantize(64,dither=Image.Dither.NONE).convert('RGB')
mix.save(out/'hooge-soft.webp',quality=89)
rng=random.Random(617);sky=Image.new('RGBA',(960,640));draw=ImageDraw.Draw(sky)
for _ in range(350):
    x,y=rng.randrange(960),rng.randrange(640);r=rng.choice([.38,.5,.7,1])
    draw.ellipse([x-r,y-r,x+r,y+r],fill=(173,200,207,rng.randrange(25,115)))
sky.save(out/'sky.png')

