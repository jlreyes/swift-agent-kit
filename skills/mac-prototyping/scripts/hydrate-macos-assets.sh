#!/bin/zsh

set -euo pipefail

if [[ $# -ne 1 ]]; then
  print -u2 "usage: hydrate-macos-assets.sh <prototype-root>"
  exit 64
fi

prototype_root=${1:A}
public_root="$prototype_root/public"
asset_root="$public_root/mac-assets"
platform=${MAC_PROTOTYPING_PLATFORM:-$(uname -s)}
sips_command=${MAC_PROTOTYPING_SIPS_COMMAND:-/usr/bin/sips}
qlmanage_command=${MAC_PROTOTYPING_QLMANAGE_COMMAND:-/usr/bin/qlmanage}
ffmpeg_command=${MAC_PROTOTYPING_FFMPEG_COMMAND:-ffmpeg}
temporary_root=""
hydrated_asset_count=0

cleanup_temporary_root() {
  local cleanup_path=${temporary_root:-}

  if [[ -z "$cleanup_path" || ! -d "$cleanup_path" ]]; then
    return 0
  fi

  if [[ "$cleanup_path" == "/" || "${cleanup_path:t}" != mac-prototyping-assets.* ]]; then
    print -u2 "mac-prototyping: refused to remove unexpected temporary path $cleanup_path"
    return 1
  fi

  /bin/rm -rf -- "$cleanup_path"
  temporary_root=""
}

cleanup_and_exit() {
  local signal_status=$1
  cleanup_temporary_root
  exit "$signal_status"
}

trap cleanup_temporary_root EXIT
trap 'cleanup_and_exit 129' HUP
trap 'cleanup_and_exit 130' INT
trap 'cleanup_and_exit 143' TERM

command_available() {
  local executable=$1

  if [[ "$executable" == */* ]]; then
    [[ -x "$executable" ]]
  else
    command -v "$executable" >/dev/null 2>&1
  fi
}

if [[ "$platform" != "Darwin" ]]; then
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

  "$sips_command" -s format png -z 256 256 "$source" --out "$destination" >/dev/null
  (( hydrated_asset_count += 1 ))
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

tahoe_movie=${MAC_PROTOTYPING_TAHOE_MOVIE:-"/System/Library/Desktop Pictures/.wallpapers/Tahoe Day/Tahoe Day.mov"}
tahoe_still="$asset_root/wallpapers/tahoe.jpg"

extract_tahoe_with_ffmpeg() {
  local candidate="$temporary_root/tahoe-ffmpeg.jpg"
  local exit_status

  if ! command_available "$ffmpeg_command"; then
    print -u2 "mac-prototyping: ffmpeg is unavailable; trying native qlmanage fallback"
    return 1
  fi

  if "$ffmpeg_command" -hide_banner -loglevel error -ss 1 -i "$tahoe_movie" \
    -frames:v 1 -vf "scale=2560:-2" -q:v 3 "$candidate" -y; then
    if [[ ! -s "$candidate" ]]; then
      print -u2 "mac-prototyping: ffmpeg produced no wallpaper; trying native qlmanage fallback"
      return 1
    fi

    if ! /bin/mv -f -- "$candidate" "$tahoe_still"; then
      print -u2 "mac-prototyping: ffmpeg output could not be installed at $tahoe_still"
      return 1
    fi

    return 0
  else
    exit_status=$?
    print -u2 "mac-prototyping: ffmpeg failed (exit $exit_status); trying native qlmanage fallback"
    return 1
  fi
}

extract_tahoe_with_qlmanage() {
  local preview="$temporary_root/${tahoe_movie:t}.png"
  local candidate="$temporary_root/tahoe-qlmanage.jpg"
  local exit_status

  if ! command_available "$qlmanage_command"; then
    print -u2 "mac-prototyping: native qlmanage fallback is unavailable"
    return 1
  fi

  if "$qlmanage_command" -t -s 2560 -o "$temporary_root" "$tahoe_movie" >/dev/null 2>&1; then
    if [[ ! -s "$preview" ]]; then
      print -u2 "mac-prototyping: qlmanage produced no preview at $preview"
      return 1
    fi
  else
    exit_status=$?
    print -u2 "mac-prototyping: qlmanage failed to extract the Tahoe wallpaper (exit $exit_status)"
    return 1
  fi

  if ! command_available "$sips_command"; then
    print -u2 "mac-prototyping: sips is unavailable; qlmanage preview could not be converted"
    return 1
  fi

  if "$sips_command" -s format jpeg "$preview" --out "$candidate" >/dev/null; then
    if [[ ! -s "$candidate" ]]; then
      print -u2 "mac-prototyping: sips produced no wallpaper from the qlmanage preview"
      return 1
    fi
  else
    exit_status=$?
    print -u2 "mac-prototyping: sips failed to convert the qlmanage preview (exit $exit_status)"
    return 1
  fi

  if ! /bin/mv -f -- "$candidate" "$tahoe_still"; then
    print -u2 "mac-prototyping: qlmanage output could not be installed at $tahoe_still"
    return 1
  fi
}

if [[ -f "$tahoe_movie" ]]; then
  if ! temporary_root=$(mktemp -d "${TMPDIR:-/tmp}/mac-prototyping-assets.XXXXXX"); then
    print -u2 "mac-prototyping: could not create a temporary directory for wallpaper extraction"
    exit 74
  fi

  if ! extract_tahoe_with_ffmpeg && ! extract_tahoe_with_qlmanage; then
    print -u2 "mac-prototyping: unable to extract the Tahoe Day wallpaper with ffmpeg or qlmanage"
    exit 74
  fi

  (( hydrated_asset_count += 1 ))
else
  print -u2 "mac-prototyping: Tahoe Day wallpaper is unavailable on this macOS install ($tahoe_movie)"
  if [[ -e "$tahoe_still" || -L "$tahoe_still" ]]; then
    if /bin/rm -f -- "$tahoe_still"; then
      print -u2 "mac-prototyping: removed stale hydrated Tahoe wallpaper at $tahoe_still"
    else
      print -u2 "mac-prototyping: could not remove stale Tahoe wallpaper at $tahoe_still"
      exit 74
    fi
  fi
fi

print "mac-prototyping: local asset hydration finished with $hydrated_asset_count asset(s) written to $asset_root"
