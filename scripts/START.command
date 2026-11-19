#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import http.server, webbrowser' >/dev/null 2>&1; then
  echo "Python 3 ist hier nicht einsatzbereit. Die vorbereiteten Unterrichtsbilder im Ordner Offline-Bilder lassen sich sofort ohne Server öffnen. Für das interaktive Modell Python 3 installieren. Alternativ kann die Lehrkraft GeoRisiko-G4.2.2-SCORM-1.2.zip ins schulische LMS importieren und dort starten."
  if [ -t 0 ]; then
    printf 'Eingabetaste zum Schließen drücken. '
    read -r answer
  fi
  exit 1
fi
exec python3 ./start_lokal.py
