"""Extract dimensionless relief detail for idealised landscapes from licensed project DEMs."""

import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parents[2]
inputs = {
    "mountain": "g5/terrain/himalaya",
    "rift": "g5/terrain/rift",
    "ocean": "g64/bathy-2308",
    "arc": "g64/bathy-1510",
    "shear": "g5/terrain/san",
    "island": "g5/terrain/hawaii",
}
result = {}
for key, file in inputs.items():
    grid = (
        np.fromfile(root / "public/data" / (file + ".i16"), dtype="<i2")
        .reshape(145, 193)
        .astype(float)
    )
    scaled = (grid - grid.min()) / (grid.max() - grid.min())
    im = Image.fromarray(np.uint8(255 * scaled)).resize(
        (65, 49), Image.Resampling.LANCZOS
    )
    detail = np.asarray(im, dtype=float) - np.asarray(
        im.filter(ImageFilter.GaussianBlur(3)), dtype=float
    )
    result[key] = (
        np.rint(np.clip(detail / (np.percentile(abs(detail), 97) or 1), -1, 1) * 100)
        .astype(int)
        .ravel()
        .tolist()
    )
(root / "src/observatory/relief-samples.json").write_text(
    json.dumps(result, separators=(",", ":")) + "\n"
)

# Interior land samples supply local colour variation without copying a coastline
# into a schematic scene. Mirroring keeps repeat edges continuous.
from PIL import ImageOps

out = Image.new("RGB", (1024, 1024))
for i, (site, box) in enumerate(
    [
        ("himalaya", (0.04, 0.2, 0.30, 0.55)),
        ("rift", (0.05, 0.26, 0.35, 0.55)),
        ("san", (0.12, 0.22, 0.51, 0.58)),
        ("himalaya", (0.50, 0.34, 0.76, 0.63)),
    ]
):
    source = Image.open(
        root / "public/data/g5/terrain" / (site + "-surface.webp")
    ).convert("RGB")
    crop = source.crop(
        tuple(round(v * source.size[j % 2]) for j, v in enumerate(box))
    ).resize((256, 256), Image.Resampling.LANCZOS)
    x, y = i % 2 * 512, i // 2 * 512
    out.paste(crop, (x, y))
    out.paste(ImageOps.mirror(crop), (x + 256, y))
    out.paste(ImageOps.flip(crop), (x, y + 256))
    out.paste(ImageOps.mirror(ImageOps.flip(crop)), (x + 256, y + 256))
out.save(root / "src/observatory/land-material.webp", quality=87, method=6)
