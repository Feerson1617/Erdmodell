#!/bin/bash
set -euo pipefail
out="$PWD/test-results/mac"
mkdir -p "$out"
product="$PWD/artifacts/macos"
mount_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/GeoRisiko-volume.XXXXXX")"
installed="$(mktemp -d "${RUNNER_TEMP:-/tmp}/GeoRisiko-install.XXXXXX")"
app="$installed/GeoRisiko.app"
exec > >(tee "$out/installation.log") 2>&1
uname -a
sw_vers
system_profiler SPHardwareDataType SPDisplaysDataType | sed -E '/Serial Number|Hardware UUID|Provisioning UDID/d'
test "$(uname -m)" = "arm64"
hdiutil verify "$product/GeoRisiko-G6.6-macOS-arm64.dmg"
hdiutil attach -readonly -nobrowse -mountpoint "$mount_dir" "$product/GeoRisiko-G6.6-macOS-arm64.dmg"
trap 'hdiutil detach "$mount_dir" >/dev/null 2>&1 || true' EXIT
test "$(readlink "$mount_dir/Applications")" = "/Applications"
ditto "$mount_dir/GeoRisiko.app" "$app"
hdiutil detach "$mount_dir"
trap - EXIT
ditto -x -k "$product/GeoRisiko-G6.6-macOS-arm64-app.zip" "$installed/zip"
for bundle in "$app" "$installed/zip/GeoRisiko.app"; do
  /usr/libexec/PlistBuddy -c "Print :LSMinimumSystemVersion" "$bundle/Contents/Info.plist"
  test -s "$bundle/Contents/Resources/app.asar"
  test -s "$bundle/Contents/Resources/icon.icns" || find "$bundle/Contents/Resources" -maxdepth 1 -iname '*.icns' | grep -q .
  test "$(lipo -archs "$bundle/Contents/MacOS/GeoRisiko")" = arm64
  codesign --verify --deep --strict --verbose=2 "$bundle"
  codesign -dv --verbose=4 "$bundle" 2>&1 | grep -E 'Signature=adhoc|Identifier=|Runtime Version'
done
cmp "$app/Contents/Resources/app.asar" "$installed/zip/GeoRisiko.app/Contents/Resources/app.asar"
# Ask Gatekeeper about a separate download-marked copy without modifying the launch copy or the policy.
quarantined="$installed/zip/GeoRisiko.app"
xattr -w com.apple.quarantine "0083;$(printf '%x' "$(date +%s)");GeoRisiko-QA;" "$quarantined"
xattr -p com.apple.quarantine "$quarantined"
if spctl --assess --type execute --verbose=4 "$quarantined"; then
  echo "Gatekeeper-Bewertung der Quarantänekopie auf diesem Runner: akzeptiert."
else
  echo "Gatekeeper-Bewertung der Quarantänekopie auf diesem Runner: abgelehnt (Status $?)."
fi
shasum -a 256 "$product/GeoRisiko-G6.6-macOS-arm64.dmg" "$product/GeoRisiko-G6.6-macOS-arm64-app.zip" artifacts/GeoRisiko-G6.6-Web-Test.html > "$out/SHA256.txt"
# LaunchServices uses the same launch mechanism as Finder. Quit gracefully before the instrumented run.
open -n "$app"
swift scripts/check-launch.swift "$app"
echo "LaunchServices-Start und Beenden der vom ausgeworfenen DMG kopierten App bestätigt."
printf '%s\n' "$app/Contents/MacOS/GeoRisiko" > "$out/executable-path.txt"
