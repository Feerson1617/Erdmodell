"""Rebuild the regional orthophoto and Copernicus surface grid from public sources."""
from pathlib import Path
from urllib.request import urlretrieve
from PIL import Image
import json
import math
import sys

west, south, east, north = (6.58, 49.932, 7.24, 50.262)
width = (east - west) * 111320 * math.cos(math.radians((north + south) / 2))
depth = (north - south) * 111320
pixels, samples = 1700, 157
cache = Path(sys.argv[1])
cache.mkdir(parents=True, exist_ok=True)

def image(url, file):
    if not file.exists():
        urlretrieve(url, file)
    return Image.open(file)

tiles = {}
for lat in (49, 50):
    for lon in (6, 7):
        key = f"Copernicus_DSM_COG_10_N{lat:02}_00_E{lon:03}_00_DEM"
        tiles[lat, lon] = image(f"https://copernicus-dem-30m.s3.amazonaws.com/{key}/{key}.tif",
                                cache / f"{lat}-{lon}.tif")
bbox = f"{west},{south},{east},{north}"
url = ("https://geo4.service24.rlp.de/wms/rp_dop20.fcgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap"
       "&LAYERS=rp_dop20&STYLES=&FORMAT=image/jpeg&SRS=EPSG:4326"
       f"&BBOX={bbox}&WIDTH={pixels}&HEIGHT={round(pixels * depth / width)}")
image(url, cache / "region.jpg").convert("RGB").save("public/data/vulkaneifel/ulmen-wittlich.webp", quality=86)

values = []
for j in range(samples):
    lat = north - (north - south) * j / (samples - 1)
    for i in range(samples):
        lon = west + (east - west) * i / (samples - 1)
        tile = tiles[int(lat), int(lon)]
        x = min(tile.width - 1, round((lon % 1) * tile.width))
        y = min(tile.height - 1, round((1 - lat % 1) * tile.height))
        values.append(round(tile.getpixel((x,y))))
Path("src/seismology/ulmen-wittlich-dsm.json").write_text(json.dumps(
    dict(box=[west,south,east,north],n=samples,width=width,depth=depth,values=values),
    separators=(",",":")) + "\n")
