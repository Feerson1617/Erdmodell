#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v python3 >/dev/null; then
  echo "Zum lokalen Start wird Python 3 benötigt. Die Schule kann das SCORM-ZIP auch im Lernmanagementsystem öffnen."
  if [ -t 0 ]; then
    printf 'Eingabetaste zum Schließen drücken. '
    read -r answer
  fi
  exit 1
fi
exec python3 ./start_lokal.py
