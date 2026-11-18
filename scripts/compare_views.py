"""Compose the four camera-matched Chromium pairs produced by browser.mjs."""

import subprocess
from pathlib import Path

source = Path("test-results")
pairs = [
    ("Globus", "01-globus-a", "02-globus-b"),
    ("Schalenmodell", "03-erdinneres-a", "04-erdinneres-b"),
    ("Hanswarft", "05-hooge-a", "06-hooge-b"),
    ("Helgoland", "12-helgoland-A", "12-helgoland-B"),
]
args = ["ffmpeg", "-v", "error", "-y", "-filter_complex_threads", "1"]
filters, positions, outputs = [], [], []
for i, (_, a, b) in enumerate(pairs):
    for j, name in enumerate((a, b)):
        n = i * 2 + j
        args.extend(["-i", str(source / (name + ".jpg"))])
        filters.append(f"[{n}:v]crop=836:533:456:132,scale=624:398,setsar=1[p{n}]")
        outputs.append(f"[p{n}]")
        positions.append(f"{j*640}_{i*439}")
filters.append(
    "".join(outputs)
    + "xstack=inputs=8:layout="
    + "|".join(positions)
    + ":fill=0x102026,pad=1296:1818:16:86:0x102026[grid]"
)
labels = [
    (16, 13, 25, "A   Scientific Stylized Realism"),
    (656, 13, 25, "B   Premium Soft-Low-Poly"),
]
labels.extend((16, 55 + i * 439, 21, pair[0]) for i, pair in enumerate(pairs))
filters.append(
    "[grid]"
    + ",".join(
        f"drawtext=font='DejaVu Sans':text='{t}':fontcolor=0xd9e8df:fontsize={size}:x={x}:y={y}"
        for x, y, size, t in labels
    )
    + "[out]"
)
subprocess.run(
    [
        *args,
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[out]",
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "-threads",
        "1",
        str(source / "vergleich.jpg"),
    ],
    check=True,
)
