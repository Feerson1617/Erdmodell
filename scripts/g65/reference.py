"""Regenerate compact references using ObsPy 1.5 and the public IU network service."""
from pathlib import Path
import hashlib
import io
import json
from urllib.request import urlopen
import sys
import numpy as np
from obspy import read
from obspy.taup import TauPyModel

out = Path("src/seismology")
url = ("https://service.earthscope.org/fdsnws/dataselect/1/query?net=IU&sta=ANMO&loc=00"
       "&cha=BHZ&starttime=2011-03-11T05:55:00&endtime=2011-03-11T06:16:00")
model = TauPyModel(model="iasp91")
paths = []
for phase, angle in [("P", 48), ("P", 93), ("S", 75), ("PcP", 40), ("PKP", 150),
                     ("PKIKP", 170), ("SKS", 118)]:
    arrival = model.get_ray_paths(source_depth_in_km=15, distance_in_degree=angle, phase_list=[phase])[0]
    raw = arrival.path
    # Preserve boundaries and turning points when thinning the ray in time.
    chosen = set(np.linspace(0, len(raw)-1, min(100,len(raw)),dtype=int))
    chosen.update([0,len(raw)-1,int(np.argmax(raw["depth"]))])
    for depth in [2891,5153.9]:
        chosen.update(np.where(np.abs(raw["depth"]-depth)<1)[0].tolist())
    points = [[round(float(raw[i]["time"]),2),round(float(raw[i]["dist"]),6),
               round(float(raw[i]["depth"]),2)] for i in sorted(chosen)]
    paths.append(dict(phase=phase, angle=angle, seconds=round(arrival.time,2), points=points))
(out/"iasp91.json").write_text(json.dumps(paths,separators=(",",":"))+"\n")
if len(sys.argv)>1:
    raw_bytes=Path(sys.argv[1]).read_bytes()
else:
    with urlopen(url,timeout=60) as response:
        raw_bytes=response.read()
expected="3e48217e2a5d4bed245f8fde0c204eacc11f7d3dfeb1a2e5b0a0c53a99bcf65c"
if hashlib.sha256(raw_bytes).hexdigest()!=expected:
    raise ValueError("MiniSEED source differs from the reviewed IU.ANMO recording")
stream=read(io.BytesIO(raw_bytes))
stream.merge()
trace=stream[0]
assert trace.id=="IU.ANMO.00.BHZ" and not np.ma.is_masked(trace.data)
values=trace.data.astype(float)
offset=float(np.mean(values))
# True minima and maxima of each second, no filtering or invented arrivals.
rate=int(trace.stats.sampling_rate)
envelope=[[int(np.min(q)),int(np.max(q))] for q in (values[i:i+rate] for i in range(0,len(values),rate))]
data=dict(id=trace.id, start=str(trace.stats.starttime), end=str(trace.stats.endtime), rate=rate,
          samples=len(values), mean=round(offset,2), unit="counts", envelope=envelope, source=url)
(out/"tohoku-anmo.json").write_text(json.dumps(data,separators=(",",":"))+"\n")
print(trace, " · IASP91", [(p["phase"],p["seconds"]) for p in paths])
