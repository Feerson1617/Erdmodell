"""Rebuild the PB2002 derivative with Python 3, Pillow and the two pinned upstream files."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "src/tectonics"
def source(path, digest):
    data = Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f"Unexpected PB2002 revision: {path}")
    return data

raw = source(sys.argv[1], "513babb111c65cd275274e2edcb249085d00e007c79d8755e1b4b79f60806f37")
features = json.loads(source(sys.argv[2], "922918f970baf7e645821a4a728b945dbb5eeac1337d71d087fba021bcc79e21"))["features"]
steps = []
for line in raw.decode("ascii").splitlines():
    steps.append([int(line[:4]), line[6:11], line[92:95], float(line[12:20]), float(line[21:28]),
                  float(line[29:37]), float(line[38:45]), float(line[56:61]), int(line[62:65])])
assert [s[0] for s in steps] == list(range(1, 5820))
(OUT / "steps.json").write_text("[\n" + ",\n".join(json.dumps(s, separators=(",", ":")) for s in steps) + "\n]\n")
width, height = 2048, 1024
canvas = Image.new("P", (width, height), 0)
draw = ImageDraw.Draw(canvas)
codes = sorted({f["properties"]["Code"] for f in features})
assert len(codes) == 52
def xy(point):
    return ((point[0]+180)*width/360, (90-point[1])*height/180)
for f in features:
    index = codes.index(f["properties"]["Code"]) + 1
    geom = f["geometry"]
    for rings in (geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]):
        for i, ring in enumerate(rings):
            draw.polygon([xy(p) for p in ring], fill=index if i == 0 else 0)
colors = [(94, 172, 153), (234, 181, 107), (129, 151, 204), (176, 151, 183), (147, 174, 107), (91, 167, 192), (199, 139, 130)]
palette = [0, 0, 0]
for i in range(len(codes)):
    palette.extend(colors[i % len(colors)])
canvas.putpalette(palette)
canvas.save(OUT / "plates.png", transparency=0, optimize=True)
# Label sites are points inside their source polygons. A horizontal interior chord supplies small-plate sites.
sites = {"AF": (16, 12), "NA": (-98, 47), "SA": (-57, -16), "EU": (66, 49), "PA": (-153, -5),
         "AU": (133, -24), "AN": (10, -77), "IN": (76, 16), "NZ": (-99, -22), "OK": (147, 52),
         "AR": (45, 24), "CA": (-74, 15), "PS": (136, 20), "SO": (51, -15), "CO": (-93, 7)}
labels = {}
for index, code in enumerate(codes, 1):
    if code in sites:
        point = sites[code]
        assert canvas.getpixel(tuple(map(int, xy(point)))) == index, code
    else:
        mask = Image.frombytes("L", canvas.size, canvas.tobytes()).point(lambda n: 255 if n == index else 0)
        x0, y0, x1, y1 = mask.getbbox()
        candidates = []
        for y in range(y0, y1, max(1, (y1-y0)//48)):
            begin = None
            for x in range(x0, x1+1):
                if x < x1 and canvas.getpixel((x,y)) == index:
                    if begin is None: begin = x
                elif begin is not None:
                    candidates.append((x-begin, (x+begin-1)/2, y))
                    begin = None
        _, x, y = max(candidates)
        point = (round((x+.5)*360/width-180, 3), round(90-(y+.5)*180/height, 3))
    labels[code] = point
(OUT / "labels.json").write_text(json.dumps(labels, indent=2)+"\n")
