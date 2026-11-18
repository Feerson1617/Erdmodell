"""Print median per-run flight metrics from two flight-audit.mjs reports."""

import json
import statistics
import sys
from pathlib import Path

reports = [json.loads(Path(path).read_text()) for path in sys.argv[1:]]
if len(reports) != 2:
    raise SystemExit("compare_profiles.py REFERENZ/profil.json KANDIDAT/profil.json")
groups = [
    [r for r in report["runs"] if r["style"] == s] for s in "AB" for report in reports
]
rows = [
    ("Bilder/s im Flug", lambda r: r["flightFps"]),
    ("95. Perzentil Bildabstand (ms)", lambda r: r["p95Ms"]),
    ("Längste Pause je Flug (ms)", lambda r: r["maxGapMs"]),
    ("Pausen über 250 ms je Flug", lambda r: r["pauses250"]),
    ("Browser-Renderer TaskDuration (ms)", lambda r: r["rendererTaskMs"]),
    ("GPU-Prozess, CPU-Sekunden", lambda r: r["gpuProcessCpuMs"] / 1000),
    ("Bilder/s an der Hanswarft", lambda r: r["site"]["fps"]),
    ("Zeichenaufrufe an der Hanswarft", lambda r: r["site"]["draws"]),
    ("Dreiecke an der Hanswarft", lambda r: r["site"]["triangles"]),
    ("GPU-Geometrien an der Hanswarft", lambda r: r["site"]["geometries"]),
    ("GPU-Texturen an der Hanswarft", lambda r: r["site"]["textures"]),
    ("Zeichenauflösung am Ziel, Faktor", lambda r: r["site"]["pixelRatio"]),
]
print("| Kennzahl | A G1 | A G1.1 | B G1 | B G1.1 |")
print("| --- | ---: | ---: | ---: | ---: |")
for label, get in rows:
    values = [statistics.median(map(get, group)) for group in groups]
    cols = [f"{v:.2f}".rstrip("0").rstrip(".").replace(".", ",") for v in values]
    print("| " + " | ".join([label, *cols]) + " |")
