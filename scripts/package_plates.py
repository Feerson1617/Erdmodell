"""Ship the independent G2a build and its evidence; reopen and exercise the extracted ZIP."""
import json
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
checks = root / "test-results/g2a"
commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, cwd=root).strip()
report = json.loads((checks / "pruefung.json").read_bytes())
assert report["commit"] == commit and {r["engine"] for r in report["runs"]} == {"chromium", "webkit"}
shots = list(checks.glob("*.jpg"))
assert len(shots) == len({p.read_bytes() for p in shots}) == 5
out = root / "artifacts/GeoRisiko-G2a-Vorschau.zip"
out.parent.mkdir(exist_ok=True)
with TemporaryDirectory(dir=out.parent) as tmp:
    archive = Path(tmp) / out.name
    with ZipFile(archive, "w", ZIP_DEFLATED) as z:
        for base, prefix in [(root / "dist-g2a", ""), (checks, "Pruefung/")]:
            for f in sorted(base.rglob("*")):
                if f.is_file():
                    z.write(f, prefix + f.relative_to(base).as_posix())
        for name in ["START.command", "start_lokal.py"]:
            z.write(root/"scripts"/name, name)
        z.write(root/"docs/abschluss-g1.3-g2a.md", "Abschlussbericht.md")
        for doc in ("g2a-platten.md", "unterricht-20-11.md", "geoscience-validation.md",
                    "g1.3-pruefbericht.md", "evidence/g13/aufloesungsprobe-webkit.json"):
            z.write(root/"docs"/doc, doc)
        z.writestr("Pruefstand.txt", f"GeoRisiko G2a · eigenständige Vorschau\nGit-Commit {commit}\n")
    with ZipFile(archive) as z:
        assert z.testzip() is None
        extracted = Path(tmp)/"entpackt"
        z.extractall(extracted)
    subprocess.run(["node", "tests/g2a.mjs", str(extracted)], check=True, cwd=root)
    os.replace(archive, out)
print(out.name, out.stat().st_size)
