#!/bin/zsh

set -euo pipefail

if [[ $# -ne 1 ]]; then
  print -u2 "usage: hydrate-macos-assets.sh <prototype-root>"
  exit 64
fi

prototype_root=${1:A}
public_root="$prototype_root/public"
asset_root="$public_root/mac-assets"

if [[ "$(uname -s)" != "Darwin" ]]; then
  print -u2 "mac-prototyping: local Apple assets require macOS"
  exit 69
fi

if [[ ! -d "$public_root" ]]; then
  print -u2 "mac-prototyping: expected a prototype with public/ at $prototype_root"
  exit 66
fi

mkdir -p "$asset_root/dock" "$asset_root/wallpapers"

convert_icon() {
  local source=$1
  local destination=$2
  local label=$3

  if [[ ! -f "$source" ]]; then
    print -u2 "mac-prototyping: skipped $label (not found at $source)"
    return 0
  fi

  /usr/bin/sips -s format png -z 256 256 "$source" --out "$destination" >/dev/null
}

convert_icon \
  "/System/Library/CoreServices/Finder.app/Contents/Resources/Finder.icns" \
  "$asset_root/dock/finder.png" \
  "Finder icon"
convert_icon \
  "/System/Applications/App Store.app/Contents/Resources/AppIcon.icns" \
  "$asset_root/dock/app-store.png" \
  "App Store icon"
convert_icon \
  "/Applications/Google Chrome.app/Contents/Resources/app.icns" \
  "$asset_root/dock/chrome.png" \
  "Google Chrome icon"
convert_icon \
  "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/DownloadsFolder.icns" \
  "$asset_root/dock/downloads.png" \
  "Downloads icon"
convert_icon \
  "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/TrashIcon.icns" \
  "$asset_root/dock/trash.png" \
  "Trash icon"

tahoe_movie="/System/Library/Desktop Pictures/.wallpapers/Tahoe Day/Tahoe Day.mov"
tahoe_still="$asset_root/wallpapers/tahoe.jpg"

if [[ -f "$tahoe_movie" ]]; then
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -hide_banner -loglevel error -ss 1 -i "$tahoe_movie" \
      -frames:v 1 -vf "scale=2560:-2" -q:v 3 "$tahoe_still" -y
  else
    temporary_root=$(mktemp -d "${TMPDIR:-/tmp}/mac-prototyping-assets.XXXXXX")
    trap 'rm -rf "$temporary_root"' EXIT
    if /usr/bin/qlmanage -t -s 2560 -o "$temporary_root" "$tahoe_movie" >/dev/null 2>&1; then
      /usr/bin/sips -s format jpeg "$temporary_root/Tahoe Day.mov.png" --out "$tahoe_still" >/dev/null
    else
      print -u2 "mac-prototyping: install ffmpeg to extract the Tahoe Day wallpaper"
    fi
  fi
else
  print -u2 "mac-prototyping: Tahoe Day wallpaper is unavailable on this macOS install"
fi

print "mac-prototyping: hydrated private local assets in $asset_root"
