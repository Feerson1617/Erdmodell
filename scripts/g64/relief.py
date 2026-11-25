"""Two cartographic views from the signed, georeferenced elevation grid shipped with GeoRisiko."""
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2] / 'public/data'
z = np.fromfile(root / 'relief.i16', '<i2').reshape(361, 721).astype(float)[:, :-1]
dy, dx = np.gradient(z)
dx = (np.roll(z, -1, axis=1) - np.roll(z, 1, axis=1)) / 2
shade = np.clip((dx - dy) / 3700, -.29, .25)
stops = [-10000, -6000, -3500, -1000, -1, 0, 200, 800, 2100, 4000, 6200]
for name, palette in [
    ('relief', ['#102b44','#254863','#41637a','#628a98','#9ec4c1','#708867','#81926f','#a2a481','#b6a183','#c0b4a5','#e5e1db']),
    ('bathy', ['#080e30','#152957','#195180','#25849b','#82cecc','#777c79','#777c79','#848780','#91908a','#a8a59f','#c4c1be']),
]:
    colors = np.array([tuple(bytes.fromhex(v[1:])) for v in palette])
    rgb = np.stack([np.interp(z, stops, colors[:, i]) for i in range(3)], axis=-1)
    img = Image.fromarray(np.clip(rgb * (1 + shade[..., None]), 0, 255).astype('uint8'))
    img.save(root / 'g64' / (name + '.webp'), quality=93, method=6)
