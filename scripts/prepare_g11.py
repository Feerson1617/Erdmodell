"""Rebuild site meshes and map scales. Inputs in docs/g1.1-data.md."""

import sys, json, subprocess, tempfile, struct
from pathlib import Path
import numpy as np
from scipy.spatial import Delaunay, cKDTree
from scipy.ndimage import distance_transform_edt
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from matplotlib.path import Path as Polygon

root = Path("public/data")
src = Path(sys.argv[1])
cfg = json.loads(Path("src/sites.json").read_text())


def raster(file, bounds, size, method):
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "grid.tif"
        subprocess.run(
            [
                "gdalwarp",
                "-q",
                "-te",
                *map(str, bounds),
                "-ts",
                *map(str, size),
                "-r",
                method,
                str(src / file),
                str(p),
            ],
            check=True,
        )
        return np.asarray(Image.open(p)).copy()


def array_image(a):
    return Image.fromarray(np.uint8(np.clip(a, 0, 255)))


def save(name, a):
    array_image(a).save(root / name, quality=88)


def ramp(arr, knots, palette):
    return np.stack(
        [np.interp(arr, knots, [c[i] for c in palette]) for i in range(3)], axis=-1
    )


# A cartographic relief palette, derived from measured elevation and the NE land mask.
photo = np.asarray(Image.open(root / "earth.webp").resize((2048, 1024)), dtype=float)
h = np.asarray(
    Image.fromarray(
        np.fromfile(root / "relief.i16", "<i2").reshape(361, 721).astype("float32")
    ).resize((2048, 1024), Image.Resampling.BILINEAR)
)
mask = Image.new("L", (2048, 1024))
draw = ImageDraw.Draw(mask)
for feature in json.loads((src / "land.json").read_text())["features"]:
    g = feature["geometry"]
    for polygon in (
        g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    ):
        for i, ring in enumerate(polygon):
            draw.polygon(
                [((x + 180) * 2048 / 360, (90 - y) * 1024 / 180) for x, y in ring],
                fill=255 if i == 0 else 0,
            )
land = np.asarray(mask) > 0
sea = ramp(
    h,
    [-6500, -3500, -500, -80, 0],
    [(23, 61, 77), (33, 83, 96), (51, 115, 122), (79, 143, 143), (98, 158, 151)],
)
terrain = ramp(
    h,
    [0, 250, 700, 1700, 3000, 5000],
    [
        (146, 167, 121),
        (158, 173, 126),
        (193, 183, 137),
        (180, 154, 116),
        (163, 145, 124),
        (231, 225, 207),
    ],
)
terrain = terrain * 0.8 + photo * 0.2
ice = (photo.min(axis=2) > 184) & land
terrain[ice] = [216, 225, 212]
save("earth-atlas.webp", np.where(land[:, :, None], terrain, sea))
# Kilometre-scale midrange follows the same composite in the North Sea region.
europe = np.asarray(Image.open(src / "north-europe.jpg").convert("RGB"), dtype=float)
ne = np.asarray(
    Image.open(root / "region.webp").convert("RGB").resize((1536, 1536)), dtype=float
)
water = ne[:, :, 0] < 90
coast_tint = np.clip(1 - distance_transform_edt(water) / 160, 0, 1) * water
europe = (
    europe * (1 - 0.97 * coast_tint[:, :, None])
    + np.array([66, 115, 124]) * 0.97 * coast_tint[:, :, None]
)
save("north-europe.webp", 0.87 * europe + 0.13 * ne)
save("north-europe-atlas.webp", 0.50 * europe + 0.50 * ne)
# Regional land use; the class labels are categorical, so sample by majority.
bounds = [7.55, 54.01, 8.99, 55.10]
classes = raster("worldcover.tif", bounds, (1280, 1640), "mode")
palette = {
    10: [76, 109, 82],
    20: [123, 143, 101],
    30: [153, 165, 111],
    40: [183, 178, 126],
    50: [164, 144, 128],
    60: [195, 184, 150],
    70: [225, 228, 220],
    80: [66, 115, 124],
    90: [137, 157, 132],
    95: [110, 144, 131],
    100: [144, 152, 132],
}
wc = np.zeros((*classes.shape, 3), dtype="uint8")
wc[:] = [66, 115, 124]
for k, v in palette.items():
    wc[classes == k] = v


def feather_water(water, radius):
    t = np.clip(1 - distance_transform_edt(water) / radius, 0, 1)
    return t * t * (3 - 2 * t)


# Avoid a rectangular sheet of uniform water around the actual island data.
land_classes = [k for k in palette if k != 80]
wet = ~np.isin(classes, land_classes)
cover_alpha = (
    feather_water(wet, 26) * np.where(wet, 0.25, 1.0) * np.isin(classes, list(palette))
)
save("northsea-cover.webp", np.dstack((wc, cover_alpha * 255)))


def ortho(name):
    a = np.asarray(Image.open(src / name).convert("RGB"), dtype=float)
    ok = (
        Image.fromarray(np.uint8(a.min(axis=2) < 241) * 255)
        .filter(ImageFilter.MinFilter(9))
        .filter(ImageFilter.GaussianBlur(6))
    )
    return a, np.asarray(ok, dtype=float)[:, :, None] / 255


a, m = ortho("wadden.jpg")
wadden_classes = raster(
    "worldcover.tif", [8.26, 54.42, 8.88, 54.80], (2048, 2048), "near"
)
wet = ~np.isin(wadden_classes, land_classes)
edge = np.clip(distance_transform_edt(m[:, :, 0] > 0.98) / 32, 0, 1)
m *= (feather_water(wet, 35) * edge * edge * (3 - 2 * edge))[:, :, None]
save("wadden-air.webp", np.concatenate([a, m * 255], axis=2))
for site in cfg:
    w, s, e, n = site["bounds"]
    lat = site["target"]["lat"]
    lon = site["target"]["lon"]
    kx = 111.19493 * np.cos(np.deg2rad(lat))
    kz = 111.19493

    def project(points):
        p = np.array(points)
        return np.column_stack(((p[:, 0] - w) / (e - w), (n - p[:, 1]) / (n - s)))

    if site["height"]["kind"] == "mounds":
        spec = site["height"]
        rx, rz = spec["radiusKm"]
        data = json.loads((root / site["features"]).read_text())
        coast = project(data["coast"])
        mounds = project([p["point"] for p in data["mounds"]])
        pts = [coast]
        # Keep far marsh/water sparse, concentrate vertices on the curved mound slopes.
        for x, y in mounds:
            for rad in [0.15, 0.5, 0.68, 0.87, 1.05, 1.25, 1.48, 1.62]:
                t = np.arange(32) * np.pi / 16
                pts.append(
                    np.column_stack(
                        (
                            x + rad * rx * np.cos(t) / (kx * (e - w)),
                            y + rad * rz * np.sin(t) / (kz * (n - s)),
                        )
                    )
                )
        grid = np.meshgrid(np.linspace(0, 1, 61), np.linspace(0, 1, 51))
        pts.append(np.column_stack([a.ravel() for a in grid]))
        # Two thin rings alongside the outline preserve the coastline step.
        for off in [-0.00018, 0.00018]:
            pts.append(np.clip(coast + [off, off], 0, 1))
        uv = np.unique(np.round(np.vstack(pts), 8), axis=0)
        dry = Polygon(coast).contains_points(uv, radius=1e-9)
        height = spec["baseM"] * dry.astype(float)
        for x, y in mounds:
            d = np.hypot(
                (uv[:, 0] - x) * (e - w) * kx / rx, (uv[:, 1] - y) * (n - s) * kz / rz
            )
            t = np.clip(d - 0.48, 0, 1)
            height += dry * spec["riseM"] * (1 - t * t * (3 - 2 * t))
        tex = Image.open(root / site["maps"]["base"]).convert("RGB")
        source = Image.open(root / site["inputs"]["orthoBase"]).convert("RGB")
        mask = Image.new("L", (1024, 1024))
        ImageDraw.Draw(mask).polygon([tuple(p * 1023) for p in coast], fill=255)
        edge = feather_water(np.asarray(mask) == 0, 0.14 / ((e - w) * kx / 1024))
        weight = array_image(edge * 255).resize(source.size, Image.Resampling.BILINEAR)
        Image.composite(source, tex.resize(source.size), weight).save(
            root / site["maps"]["A"], quality=88
        )
        original = np.asarray(tex, dtype=float)
        air = np.asarray(
            Image.open(root / site["maps"]["A"])
            .resize(tex.size)
            .filter(ImageFilter.GaussianBlur(5)),
            dtype=float,
        )
        # Salzwiesen, Wege und Priele come from the vector cartography; tonal field texture from DOP.
        save(site["maps"]["B"], original * 0.86 + air * 0.14)
    else:
        # Grid samples lie at the boundary vertices (half-cell expansion for GDAL).
        inputs = site["inputs"]
        nx, ny = inputs["grid"]
        dx = (e - w) / (nx - 1)
        dy = (n - s) / (ny - 1)
        hm = raster(
            inputs["dem"],
            [w - dx / 2, s - dy / 2, e + dx / 2, n + dy / 2],
            (nx, ny),
            "bilinear",
        )
        hm = np.maximum(hm, 0)
        (root / site["height"]["file"]).write_text(
            json.dumps(
                dict(
                    width=nx, height=ny, meters=hm.round().astype(int).ravel().tolist()
                ),
                separators=(",", ":"),
            )
        )
        grid = np.meshgrid(np.linspace(0, 1, nx), np.linspace(0, 1, ny))
        uv = np.column_stack([a.ravel() for a in grid])
        height = hm.ravel()
        dry = height > 0.4
        a, m = ortho(inputs["ortho"])
        high = np.asarray(
            Image.fromarray(hm).resize(
                (a.shape[1], a.shape[0]), Image.Resampling.BILINEAR
            )
        )
        # Fade photographic open water over ~240 m, retaining surf and intertidal detail.
        shore = np.clip(1 - distance_transform_edt(high < 0.35) / 76, 0, 1)
        m *= (shore * shore * (3 - 2 * shore))[:, :, None]
        base = a * m + [66, 115, 124] * (1 - m)
        save(site["maps"]["A"], base)
        cart = ramp(
            high,
            [0, 1, 3, 12, 30, 55],
            [
                (59, 116, 125),
                (204, 189, 148),
                (165, 170, 127),
                (160, 140, 110),
                (162, 126, 98),
                (157, 166, 118),
            ],
        )
        save(site["maps"]["B"], cart * 0.85 + base * 0.15)
    # Positive values are land, negative values feather the coastal water into its surroundings.
    xy = uv * np.array([(e - w) * kx, (n - s) * kz])
    distances = cKDTree(xy[dry]).query(xy)[0] if np.any(dry) else np.full(len(xy), 1.0)
    coast_weight = np.where(dry, 1.0, -np.clip(distances / 0.75, 0, 1))
    tri = Delaunay(uv).simplices[:, [0, 2, 1]].astype("<u2")
    assert len(uv) < 65536 and np.isfinite(height).all()
    with (root / site["mesh"]).open("wb") as f:
        f.write(struct.pack("<II", len(uv), tri.size))
        f.write(
            np.column_stack((uv, height * 0.001, coast_weight)).astype("<f4").tobytes()
        )
        f.write(tri.tobytes())
    print(site["id"], len(uv), len(tri), float(height.max()))
