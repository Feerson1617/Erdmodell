"""Illustrative material roughness inferred from optical brightness and terrain, not a field measurement."""
from pathlib import Path
from PIL import Image
import numpy as np
p=Path(__file__).resolve().parents[2]/'public/data/g5/terrain'
for file in p.glob('*-surface.webp'):
    a=np.asarray(Image.open(file).convert('RGB').resize((384,288)),dtype=float)/255
    bright=a.mean(axis=2);water=(a[:,:,2]>a[:,:,0]*1.10)&(a[:,:,1]>a[:,:,0]*1.08)
    val=np.where(water,.40,.92-.21*bright);Image.fromarray(np.uint8(val*255)).save(p/(file.name.replace('surface','rough')),lossless=True)
