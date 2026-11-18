"""Inspect captured 25 Hz MP4 and CDP presentation timestamps, using FFmpeg + stdlib."""

import json, statistics, subprocess, sys
from pathlib import Path

folder = Path(sys.argv[1])


def ff(*args):
    return subprocess.check_output(["ffmpeg", "-v", "error", "-y", *map(str, args)])


style = "A"
movie = folder / f"flug-{style}.mp4"
ts = json.loads((folder / f"bildzeiten-{style}.json").read_text())
gaps = [b - a for a, b in zip(ts, ts[1:])]
assert len(ts) > 10 and all(g >= 0 for g in gaps) and ts[-1] > 5000
# Central unoccluded portion of the landscape at the audit's fixed viewport.
roi = "crop=iw*0.40:ih*0.46:iw*0.45:ih*0.26,scale=64:40,format=gray"
raw = ff("-i", movie, "-vf", roi, "-f", "rawvideo", "-threads", "1", "-")
frames = [raw[i : i + 2560] for i in range(0, len(raw), 2560)]
changes = []
flat = []
for i, frame in enumerate(frames):
    if statistics.pstdev(frame) < 3:
        flat.append(i * 40)
    if i:
        mad = sum(abs(x - y) for x, y in zip(frames[i - 1], frame)) / (2560 * 255)
        changes.append((round(mad, 4), i * 40))
moments = sorted(changes, reverse=True)[:8]
blanks = sum(1 for f in frames if max(f) - min(f) < 4)
results = {
    "roi": "45–85% x, 26–72% y; 64 × 40 Luma",
    "cdpFrames": len(ts),
    "durationMs": ts[-1],
    "longestPresentationGapMs": max(gaps),
    "gapsAbove250Ms": sum(g > 250 for g in gaps),
    "largestChanges": [
        {"timeMs": t, "meanAbsoluteLumaChange": d} for d, t in moments
    ],
    "lowContrastAtMs": flat,
    "nearUniformFrames": blanks,
}
trace = folder / f"aufnahme-{style}.json"
if trace.exists():
    states = json.loads(trace.read_text())
    for mark in results["largestChanges"]:
        nearest = min(states, key=lambda s: abs(s["t"] - mark["timeMs"]))
        mark["nearestAnimationFrame"] = nearest
(folder / f"bilder-{style}.json").write_text(json.dumps(results, indent=2))
# Sixteen chronological whole frames; preserve holds in their recorded duration.
ff(
    "-i",
    movie,
    "-vf",
    f"fps={15.5/max(.1,ts[-1]/1000)},scale=384:216,tile=4x4:padding=2",
    "-frames:v",
    "1",
    "-threads",
    "1",
    folder / f"filmstreifen-{style}.jpg",
)
print(
    style,
    len(ts),
    "gelieferte Bilder, längste Pause",
    max(gaps),
    "ms, kontrastarme Proben",
    len(flat),
)
if blanks > len(frames) * 0.15:
    raise ValueError(
        "Mehr als 15 % nahezu einfarbige Bildmitten; Aufzeichnung prüfen"
    )
