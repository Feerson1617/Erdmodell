"""Start the extracted atlas on a dynamically assigned loopback port."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

folder = Path(__file__).resolve().parent
with ThreadingHTTPServer(
    ("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(folder))
) as server:
    url = f"http://127.0.0.1:{server.server_port}/"
    print(
        f"GeoRisiko 3D im Browser öffnen: {url}\nZum Beenden Ctrl+C drücken.",
        flush=True,
    )
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
