"""Download static NASA GIBS Blue Marble tiles (EPSG:4326, matrix 6) into three feathered patches."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen
from PIL import Image

target = Path(__file__).resolve().parents[1] / "src/tectonics"
base = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/6"
patches = [("island", 31, 3, 8, 5), ("japan", 68, 9, 7, 5), ("san", 10, 10, 7, 5)]

def fetch(tile):
    x, y = tile
    with urlopen(f"{base}/{y}/{x}.jpeg", timeout=40) as r:
        im = Image.open(BytesIO(r.read())).convert("RGB")
    assert im.size == (512, 512)
    return x, y, im

for name, col, row, nx, ny in patches:
    atlas = Image.new("RGB", (nx*512, ny*512))
    with ThreadPoolExecutor(max_workers=4) as pool:
        for x, y, im in pool.map(fetch, [(x,y) for y in range(row,row+ny) for x in range(col,col+nx)]):
            atlas.paste(im, ((x-col)*512, (y-row)*512))
    # The outer 2% blend into the native globe. Interior pixels retain the source colours.
    w,h = atlas.size
    alpha = Image.new("L", (w,h), 0)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(alpha)
    margin = round(min(w,h)*0.02)
    for i in range(margin+1):
        draw.rectangle((i,i,w-1-i,h-1-i),fill=round(255*i/margin))
    atlas.putalpha(alpha)
    atlas.save(target/f"{name}.webp",quality=84,method=4)
    print(name, [-180+col*4.5,90-(row+ny)*4.5,-180+(col+nx)*4.5,90-row*4.5])
