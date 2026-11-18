#!/usr/bin/env python3
"""Rebuild the Nyos site from public Copernicus and NASA sources.

Run with GDAL Python bindings, NumPy, SciPy, Pillow and --cache <local folder>.
Downloads are preparation-time only. The application reads the committed derivatives.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from osgeo import gdal, ogr
from PIL import Image
from scipy import ndimage

gdal.UseExceptions()
gdal.SetConfigOption("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
gdal.SetConfigOption("GDAL_HTTP_MAX_RETRY", "3")
gdal.SetConfigOption("GDAL_HTTP_RETRY_DELAY", "2")

ROOT = Path(__file__).resolve().parents[1]
BOUNDS = (10.244, 6.394, 10.354, 6.516)
VICINITY = (10.055, 6.258, 10.55, 6.702)
IMAGE_SIZE = (1220, 1356)
TERRAIN_SIZE = (397, 441)
S2_SCENE = "S2A_32NPN_20250110_0_L2A"
S2_ROOT = f"https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/32/N/PN/2025/1/{S2_SCENE}"
DEM_TILE = "Copernicus_DSM_COG_10_N06_00_E010_00_DEM"
DEM_URL = f"https://copernicus-dem-30m.s3.amazonaws.com/{DEM_TILE}/{DEM_TILE}.tif"
DEM_SHA = "0f9953026c1982cc6866b28c62b42530c452e4c38da8955dda5f248d3478009d"
GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/6"


def download(url, path):
    if not path.exists():
        with urlopen(url, timeout=80) as src:
            data = src.read()
        path.write_bytes(data)
    return path


def crop_band(cache, band, bounds, size, name):
    output = cache / f"{S2_SCENE}-{name}-{band}.tif"
    if not output.exists():
        pending = output.with_suffix(".partial.tif")
        gdal.Warp(
            str(pending), f"/vsicurl/{S2_ROOT}/{band}.tif",
            dstSRS="EPSG:4326", outputBounds=bounds, width=size[0], height=size[1],
            resampleAlg="near" if band == "SCL" else "bilinear",
        )
        pending.replace(output)
    return gdal.Open(str(output))


def optical_assets(cache, asset_dir):
    view = crop_band(cache, "TCI", BOUNDS, IMAGE_SIZE, "local")
    rgb = view.ReadAsArray().transpose(1, 2, 0)
    assert np.all(rgb.any(axis=2)), "TCI coverage incomplete"
    Image.fromarray(rgb).save(asset_dir / "surface.webp", quality=91, method=6)
    wide = crop_band(cache, "TCI", VICINITY, (1536, 1376), "vicinity")
    regional_rgb = wide.ReadAsArray().transpose(1, 2, 0)
    assert np.all(regional_rgb.any(axis=2)), "Vicinity extends outside the granule"
    Image.fromarray(regional_rgb).save(asset_dir / "vicinity.webp", quality=85, method=6)

    scl = crop_band(cache, "SCL", BOUNDS, IMAGE_SIZE, "local").ReadAsArray()
    assert np.count_nonzero(np.isin(scl, [0, 1, 3, 8, 9, 10, 11])) == 0, "Local cloud or invalid pixel"
    green = crop_band(cache, "B03", BOUNDS, IMAGE_SIZE, "local").ReadAsArray()
    near_ir = crop_band(cache, "B08", BOUNDS, IMAGE_SIZE, "local").ReadAsArray()
    return view, scl, green, near_ir


def observed_shore(view, scl, green, nir):
    # Positive green-minus-NIR is the sign of NDWI (the bands share scale and offset).
    # Constrain to the vicinity of independently classified SCL water to exclude dark fields.
    pixel = gdal.ApplyGeoTransform(gdal.InvGeoTransform(view.GetGeoTransform()), 10.298, 6.438)
    ix, iy = map(int, pixel)
    assert scl[iy, ix] == 6
    near_water = ndimage.distance_transform_edt(scl != 6) <= 6
    components, _ = ndimage.label((green > nir) & near_water)
    assert components[iy, ix] != 0
    lake = ndimage.binary_fill_holes(components == components[iy, ix])
    lake = ndimage.gaussian_filter(lake.astype("float32"), 0.8) >= 0.5
    geomask = gdal.GetDriverByName("MEM").Create("", lake.shape[1], lake.shape[0], 1, gdal.GDT_Byte)
    geomask.SetGeoTransform(view.GetGeoTransform())
    geomask.SetProjection(view.GetProjection())
    band = geomask.GetRasterBand(1)
    band.WriteArray(lake.astype("uint8"))
    out = ogr.GetDriverByName("Memory").CreateDataSource("water")
    layer = out.CreateLayer("water", view.GetSpatialRef(), ogr.wkbPolygon)
    gdal.Polygonize(band, band, layer, -1, [])
    assert layer.GetFeatureCount() == 1
    feature = layer.GetNextFeature()
    polygon = feature.GetGeometryRef().SimplifyPreserveTopology(0.00009)
    assert polygon.IsValid() and polygon.GetGeometryCount() == 1
    ring = [[round(x, 6), round(y, 6)] for x, y in polygon.GetGeometryRef(0).GetPoints()[:-1]]
    center = polygon.Centroid()
    return ring, dict(lat=round(center.GetY(), 6), lon=round(center.GetX(), 6))


def elevation_grid(cache, out, anchor):
    src = download(DEM_URL, cache / f"{DEM_TILE}.tif")
    assert hashlib.sha256(src.read_bytes()).hexdigest() == DEM_SHA
    w, s, e, n = BOUNDS
    width, height = TERRAIN_SIZE
    dx, dy = (e - w) / (width - 1), (n - s) / (height - 1)
    # GDAL outputBounds describe pixel edges; mesh samples must land on the first/last node.
    dem = gdal.Warp("", str(src), format="MEM", dstSRS="EPSG:4326",
                    outputBounds=(w - dx / 2, s - dy / 2, e + dx / 2, n + dy / 2),
                    width=width, height=height, resampleAlg="bilinear").ReadAsArray()
    assert np.isfinite(dem).all() and dem.min() > 0 and dem.max() < 4000
    grid = np.rint(dem).astype("<i2")
    grid.tofile(out / "elevation.i16")
    col, row = round((anchor["lon"] - w) / dx), round((n - anchor["lat"]) / dy)
    water = grid[row-3:row+4, col-3:col+4]
    assert water.min() == water.max(), "Central lake surface should be flat in GLO-30"
    return int(water[3,3]), [int(grid.min()), int(grid.max())]


def cameroon(cache, out):
    # WMTS matrix 6 uses 4.5°-square tiles in EPSG:4326.
    mosaic = Image.new("RGB", (1536, 1536))
    for row in range(17, 20):
        for col in range(41, 44):
            file = download(f"{GIBS}/{row}/{col}.jpeg", cache / f"gibs-6-{row}-{col}.jpg")
            with Image.open(file) as im:
                assert im.size == (512, 512)
                mosaic.paste(im.convert("RGB"), (512*(col-41), 512*(row-17)))
    mosaic.save(out / "cameroon.webp", quality=85, method=6)
    return {"bounds": [4.5, 0, 18, 13.5], "file": "cameroon.webp"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    out = ROOT / "public/data/nyos"
    out.mkdir(parents=True, exist_ok=True)
    view, scl, green, nir = optical_assets(args.cache, out)
    shore, anchor = observed_shore(view, scl, green, nir)
    level, extrema = elevation_grid(args.cache, out, anchor)
    bounds_width_km = (BOUNDS[2]-BOUNDS[0])*111.195*math.cos(math.radians(anchor["lat"]))
    data = dict(anchor=anchor, bounds=BOUNDS, width=TERRAIN_SIZE[0], height=TERRAIN_SIZE[1],
                waterLevelM=level, heightRangeM=extrema, heightFile="elevation.i16",
                surfaceFile="surface.webp", shoreline=shore, regional=cameroon(args.cache, out),
                vicinity={"bounds": VICINITY, "file": "vicinity.webp"})
    (out / "landscape.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Nyos: {len(shore)} shoreline vertices, anchor {anchor}, DSM {extrema} m, water {level} m, width {bounds_width_km:.1f} km")


if __name__ == "__main__":
    main()
