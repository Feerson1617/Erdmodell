"""Set the start of the recorded lesson to the first rendered geographic globe."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

folder = Path(__file__).resolve().parents[1] / "test-results/plattenatlas"
path = folder / "bedienung.webm"
protocol = folder / "pruefung.json"
report = json.loads(protocol.read_text())
run = next(r for r in report["runs"] if r["engine"] == "chromium")
digest = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
assert digest(path) == run["videoSHA256"]
if "videoStartSeconds" in run:
    raise SystemExit(0)

# The top bar may appear before the texture. Inspect the centre of the 3D view.
width, height, fps = 96, 64, 5
frames = subprocess.check_output(["ffmpeg","-v","error","-i",str(path),"-vf",
    f"fps={fps},scale={width}:{height}", "-pix_fmt","rgb24","-f","rawvideo","pipe:1"])
stride = width * height * 3
def globe_at(offset):
    bright = 0
    for y in range(23,45):
        for x in range(36,62):
            pixel = offset + (y*width+x)*3
            red, green, blue = frames[pixel:pixel+3]
            if max(red,green,blue)>90 and max(red,green,blue)-min(red,green,blue)>25:
                bright += 1
    return bright > 160

start = next(i for i in range(len(frames)//stride) if globe_at(i*stride))/fps
run["videoStartSeconds"] = start
run["videoOriginalSHA256"] = digest(path)
if start > .2:
    with tempfile.TemporaryDirectory(dir=folder) as tmp:
        cut = Path(tmp)/path.name
        subprocess.run(["ffmpeg","-v","error","-ss",str(start),"-i",str(path),"-an",
            "-c:v","libvpx-vp9","-crf","31","-b:v","0","-deadline","realtime","-cpu-used","6",
            "-threads","2",str(cut)],check=True)
        cut.replace(path)
run["videoSHA256"] = digest(path)
protocol.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(f"Bedienfilm ab sichtbarem Globus, ursprünglicher Zeitstempel {start:.1f} s.")
