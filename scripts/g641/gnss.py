"""Extract geographically distributed published NGL horizontal velocities (IGS14, m/yr)."""

import hashlib
import json
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_bytes()
if (
    hashlib.sha256(source).hexdigest()
    != "0e3ac38650780a517b142c07bf21be9cda8c426b37c20940d6db693c7fe9a036"
):
    raise ValueError("Expected the documented IGS14 solution")
ids = set(
    "ALGO ALIC AREQ AUCK BAKO BRAZ BRFT CAS1 CRO1 DAV1 GOLD GUAM HARB HOFN IISC KELY KOKB KOUR LHAZ MAD2 MAS1 MCM4 MKEA NYAL POTS REYK SANT SUTH THTI TIDB TSKB WTZR YELL".split()
)
rows = []
for line in source.decode().splitlines():
    r = line.split()
    if r[0] in ids:
        rows.append(
            dict(
                id=r[0],
                lat=float(r[-3]),
                lon=(float(r[-2]) + 180) % 360 - 180,
                east=round(float(r[8]) * 1000, 2),
                north=round(float(r[9]) * 1000, 2),
                start=r[2],
                end=r[3],
            )
        )
assert sorted(ids) == sorted(r["id"] for r in rows)
(Path(__file__).resolve().parents[2] / "src/observatory/gnss.json").write_text(
    json.dumps(rows, separators=(",", ":")) + "\n"
)
