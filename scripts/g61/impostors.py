"""Assemble the six pairs produced by impostors.mjs (local Vite port 4847)."""
from PIL import Image
from pathlib import Path
import hashlib,json,sys
out=Path(__file__).resolve().parents[2]/'public/data/g61'
canvas=Image.new('RGBA',(1024,768));rows=[]
for j,name in enumerate(['tree_small_02','pine_tree_01','shrub_02','grass_medium_01','rock_07','drygrass']):
    for i in range(2):
        a=Image.open(Path(sys.argv[1])/(name+str(i)+'.png')).convert('RGBA')
        a=a.crop(a.getbbox());a.thumbnail((246,248),Image.Resampling.LANCZOS);k=j*2+i
        canvas.alpha_composite(a,(256*(k%4)+(256-a.width)//2,256*(k//4)+252-a.height));rows.append([a.width,a.height])
p=out/'mitte.webp';canvas.save(p,quality=91,method=5)
(out/'mitte-source.json').write_text(json.dumps(dict(source='Orthographic views of the CC0 glTF assets listed in specimens.json. Dry meadow grass is a seasonal material variant.',license='CC0-1.0',cells=rows,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()),indent=2)+'\n')
