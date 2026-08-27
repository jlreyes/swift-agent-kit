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
chrome_icon_source=${MAC_PROTOTYPING_CHROME_ICON_SOURCE:-"/Applications/Google Chrome.app/Contents/Resources/app.icns"}
temporary_root=""
hydrated_asset_count=0

cleanup_temporary_root() {
  local cleanup_path=${temporary_root:-}

  if [[ -z "$cleanup_path" || ! -d "$cleanup_path" ]]; then
    return 0
  fi

  if [[ "$cleanup_path" == "/" || "${cleanup_path:t}" != .mac-prototyping-assets.* || \
    "${cleanup_path:h:A}" != "${asset_root:A}" ]]; then
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

remove_stale_hydrated_asset() {
  local destination=$1
  local label=$2

  if [[ ! -e "$destination" && ! -L "$destination" ]]; then
    return 0
  fi

  if /bin/rm -f -- "$destination"; then
    print -u2 "mac-prototyping: removed stale hydrated $label at $destination"
    return 0
  fi

  print -u2 "mac-prototyping: could not remove stale hydrated $label at $destination"
  return 74
}

hydrated_asset_is_valid() {
  local asset=$1
  local format=$2
  local signature

  if [[ ! -f "$asset" || -L "$asset" || ! -s "$asset" ]]; then
    return 1
  fi

  case "$format" in
    png)
      signature=$(/usr/bin/xxd -p -l 8 "$asset" 2>/dev/null) || return 1
      [[ "$signature" == "89504e470d0a1a0a" ]]
      ;;
    jpeg)
      signature=$(/usr/bin/xxd -p -l 3 "$asset" 2>/dev/null) || return 1
      [[ "$signature" == "ffd8ff" ]]
      ;;
    *)
      print -u2 "mac-prototyping: unsupported hydrated asset format $format"
      return 64
      ;;
  esac
}

# Returns EX_IOERR (74) without changing an existing destination when the
# staged asset or destination shape cannot be installed safely.
install_hydrated_asset() {
  local candidate=$1
  local destination=$2
  local label=$3
  local format=$4

  if ! hydrated_asset_is_valid "$candidate" "$format"; then
    print -u2 "mac-prototyping: $label produced an invalid $format asset; preserved existing asset at $destination"
    return 74
  fi

  # `mv source existing-directory` changes meaning and nests the candidate.
  # Reject real directories and symlinks to directories before the rename.
  if [[ -d "$destination" ]]; then
    print -u2 "mac-prototyping: cannot install $label because destination is a directory; preserved $destination"
    return 74
  fi

  if ! /bin/mv -fh -- "$candidate" "$destination"; then
    print -u2 "mac-prototyping: could not install $label at $destination; preserved existing asset"
    return 74
  fi

  if ! hydrated_asset_is_valid "$destination" "$format"; then
    print -u2 "mac-prototyping: installed $label failed final $format validation at $destination"
    return 74
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

# Keep staged files beside their destinations so the final move is a same-volume
# rename. The guarded EXIT trap removes this directory on every failure path.
if ! temporary_root=$(mktemp -d "$asset_root/.mac-prototyping-assets.XXXXXX"); then
  print -u2 "mac-prototyping: could not create a temporary directory for asset hydration"
  exit 74
fi

convert_icon() {
  local source=$1
  local destination=$2
  local label=$3
  local candidate="$temporary_root/icon-${destination:t}"
  local exit_status

  if [[ ! -f "$source" ]]; then
    print -u2 "mac-prototyping: skipped $label (not found at $source)"
    if ! remove_stale_hydrated_asset "$destination" "$label"; then
      return 74
    fi
    return 0
  fi

  if "$sips_command" -s format png -z 256 256 "$source" --out "$candidate" >/dev/null; then
    :
  else
    exit_status=$?
    print -u2 "mac-prototyping: $label conversion failed (exit $exit_status); preserved existing asset at $destination"
    return "$exit_status"
  fi

  if ! install_hydrated_asset "$candidate" "$destination" "$label conversion" png; then
    return 74
  fi

  (( hydrated_asset_count += 1 ))
}

hydrate_icon() {
  local exit_status

  if convert_icon "$@"; then
    return 0
  else
    exit_status=$?
    exit "$exit_status"
  fi
}

hydrate_icon \
  "/System/Library/CoreServices/Finder.app/Contents/Resources/Finder.icns" \
  "$asset_root/dock/finder.png" \
  "Finder icon"
hydrate_icon \
  "/System/Applications/App Store.app/Contents/Resources/AppIcon.icns" \
  "$asset_root/dock/app-store.png" \
  "App Store icon"
hydrate_icon \
  "$chrome_icon_source" \
  "$asset_root/dock/chrome.png" \
  "Google Chrome icon"
hydrate_icon \
  "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/DownloadsFolder.icns" \
  "$asset_root/dock/downloads.png" \
  "Downloads icon"
hydrate_icon \
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
    if ! install_hydrated_asset "$candidate" "$tahoe_still" "ffmpeg Tahoe wallpaper" jpeg; then
      print -u2 "mac-prototyping: ffmpeg wallpaper install failed; trying native qlmanage fallback"
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
    :
  else
    exit_status=$?
    print -u2 "mac-prototyping: sips failed to convert the qlmanage preview (exit $exit_status)"
    return 1
  fi

  if ! install_hydrated_asset "$candidate" "$tahoe_still" "qlmanage Tahoe wallpaper" jpeg; then
    return 1
  fi
}

if [[ -f "$tahoe_movie" ]]; then
  if ! extract_tahoe_with_ffmpeg && ! extract_tahoe_with_qlmanage; then
    print -u2 "mac-prototyping: unable to extract the Tahoe Day wallpaper with ffmpeg or qlmanage"
    exit 74
  fi

  (( hydrated_asset_count += 1 ))
else
  print -u2 "mac-prototyping: Tahoe Day wallpaper is unavailable on this macOS install ($tahoe_movie)"
  if ! remove_stale_hydrated_asset "$tahoe_still" "Tahoe wallpaper"; then
    exit 74
  fi
fi

print "mac-prototyping: local asset hydration finished with $hydrated_asset_count asset(s) written to $asset_root"
