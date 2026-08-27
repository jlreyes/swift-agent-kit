#!/bin/zsh

set -euo pipefail

script_root=${0:A:h:h}
hydrator="$script_root/hydrate-macos-assets.sh"
test_root=$(mktemp -d "${TMPDIR:-/tmp}/hydrate-macos-assets-test.XXXXXX")
tools_root="$test_root/tools"
runtime_root="$test_root/runtime"

cleanup() {
  local exit_status=$?
  /bin/rm -rf -- "$test_root"
  return "$exit_status"
}

trap cleanup EXIT

fail() {
  print -u2 "hydrate-macos-assets.test: $1"
  exit 1
}

assert_contains() {
  local file=$1
  local expected=$2

  /usr/bin/grep -Fq -- "$expected" "$file" || fail "expected '$expected' in $file"
}

assert_no_extraction_temporary_directories() {
  local leftovers=(
    "$runtime_root"/mac-prototyping-assets.*(N)
    "$test_root"/**/.mac-prototyping-assets.*(ND)
  )

  (( ${#leftovers} == 0 )) || \
    fail "asset hydration temporary directory was not removed: ${leftovers[*]}"
}

mkdir -p "$tools_root" "$runtime_root"

apply_fake_tool() {
  local destination=$1
  local body=$2

  print -r -- "$body" >"$destination"
  chmod +x "$destination"
}

apply_fake_tool "$tools_root/ffmpeg" '#!/bin/sh
printf "%s\n" "called" >>"$FAKE_FFMPEG_MARKER"
if [ "${FAKE_FFMPEG_RESULT:-success}" = "failure" ]; then
  exit 23
fi
previous=
destination=
for argument do
  destination=$previous
  previous=$argument
done
printf "%s\n" "ffmpeg wallpaper" >"$destination"'

apply_fake_tool "$tools_root/qlmanage" '#!/bin/sh
printf "%s\n" "called" >>"$FAKE_QLMANAGE_MARKER"
if [ "${FAKE_QLMANAGE_RESULT:-success}" = "failure" ]; then
  exit 24
fi
output=
movie=
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      output=$2
      shift 2
      ;;
    -s)
      shift 2
      ;;
    -t)
      shift
      ;;
    *)
      movie=$1
      shift
      ;;
  esac
done
mkdir -p "$output"
printf "%s\n" "qlmanage wallpaper" >"$output/${movie##*/}.png"'

apply_fake_tool "$tools_root/sips" '#!/bin/sh
previous=
input=
output=
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out" ]; then
    input=$previous
    output=$2
    break
  fi
  previous=$1
  shift
done
if [ -z "${FAKE_SIPS_FAIL_INPUT:-}" ] || [ "$input" = "$FAKE_SIPS_FAIL_INPUT" ]; then
  case "${FAKE_SIPS_RESULT:-success}" in
    failure)
      exit 25
      ;;
    truncate-failure)
      : >"$output"
      exit 25
      ;;
    invalid-success)
      printf "%s\n" "not a png" >"$output"
      exit 0
      ;;
  esac
fi
case "$output" in
  *.png)
    printf "\211PNG\r\n\032\n%s\n" "fake png" >"$output"
    ;;
  *)
    cp "$input" "$output"
    ;;
esac'

run_success_case() {
  local name=$1
  local ffmpeg_result=$2
  local qlmanage_result=$3
  local prototype="$test_root/$name/prototype"
  local movie="$test_root/$name/Tahoe Day.mov"
  local stdout="$test_root/$name/stdout"
  local stderr="$test_root/$name/stderr"
  local ffmpeg_marker="$test_root/$name/ffmpeg-marker"
  local qlmanage_marker="$test_root/$name/qlmanage-marker"

  mkdir -p "$prototype/public"
  print -r -- "movie" >"$movie"

  if env \
    TMPDIR="$runtime_root" \
    MAC_PROTOTYPING_PLATFORM=Darwin \
    MAC_PROTOTYPING_TAHOE_MOVIE="$movie" \
    MAC_PROTOTYPING_FFMPEG_COMMAND="$tools_root/ffmpeg" \
    MAC_PROTOTYPING_QLMANAGE_COMMAND="$tools_root/qlmanage" \
    MAC_PROTOTYPING_SIPS_COMMAND="$tools_root/sips" \
    FAKE_FFMPEG_RESULT="$ffmpeg_result" \
    FAKE_FFMPEG_MARKER="$ffmpeg_marker" \
    FAKE_QLMANAGE_RESULT="$qlmanage_result" \
    FAKE_QLMANAGE_MARKER="$qlmanage_marker" \
    FAKE_SIPS_RESULT=success \
    "$hydrator" "$prototype" >"$stdout" 2>"$stderr"; then
    :
  else
    local run_status=$?
    /bin/cat "$stderr" >&2
    fail "$name returned $run_status"
  fi

  [[ -s "$prototype/public/mac-assets/wallpapers/tahoe.jpg" ]] || fail "$name produced no wallpaper"
  [[ -s "$ffmpeg_marker" ]] || fail "$name did not try ffmpeg"
  assert_no_extraction_temporary_directories
}

run_success_case ffmpeg-success success failure
[[ ! -e "$test_root/ffmpeg-success/qlmanage-marker" ]] || fail "qlmanage ran after ffmpeg succeeded"
assert_contains "$test_root/ffmpeg-success/prototype/public/mac-assets/wallpapers/tahoe.jpg" "ffmpeg wallpaper"

run_success_case native-fallback failure success
[[ -s "$test_root/native-fallback/qlmanage-marker" ]] || fail "qlmanage did not run after ffmpeg failed"
assert_contains "$test_root/native-fallback/stderr" "ffmpeg failed (exit 23); trying native qlmanage fallback"
assert_contains "$test_root/native-fallback/prototype/public/mac-assets/wallpapers/tahoe.jpg" "qlmanage wallpaper"

failure_root="$test_root/all-methods-fail"
failure_prototype="$failure_root/prototype"
failure_movie="$failure_root/Tahoe Day.mov"
mkdir -p "$failure_prototype/public"
print -r -- "movie" >"$failure_movie"

if env \
  TMPDIR="$runtime_root" \
  MAC_PROTOTYPING_PLATFORM=Darwin \
  MAC_PROTOTYPING_TAHOE_MOVIE="$failure_movie" \
  MAC_PROTOTYPING_FFMPEG_COMMAND="$tools_root/ffmpeg" \
  MAC_PROTOTYPING_QLMANAGE_COMMAND="$tools_root/qlmanage" \
  MAC_PROTOTYPING_SIPS_COMMAND="$tools_root/sips" \
  FAKE_FFMPEG_RESULT=failure \
  FAKE_FFMPEG_MARKER="$failure_root/ffmpeg-marker" \
  FAKE_QLMANAGE_RESULT=failure \
  FAKE_QLMANAGE_MARKER="$failure_root/qlmanage-marker" \
  FAKE_SIPS_RESULT=success \
  "$hydrator" "$failure_prototype" >"$failure_root/stdout" 2>"$failure_root/stderr"; then
  fail "all-methods-fail unexpectedly succeeded"
else
  failure_status=$?
fi

[[ "$failure_status" -eq 74 ]] || fail "all-methods-fail returned $failure_status instead of 74"
[[ ! -e "$failure_prototype/public/mac-assets/wallpapers/tahoe.jpg" ]] || fail "failed extraction installed a wallpaper"
assert_contains "$failure_root/stderr" "ffmpeg failed (exit 23); trying native qlmanage fallback"
assert_contains "$failure_root/stderr" "qlmanage failed to extract the Tahoe wallpaper (exit 24)"
assert_contains "$failure_root/stderr" "unable to extract the Tahoe Day wallpaper with ffmpeg or qlmanage"
assert_no_extraction_temporary_directories

missing_root="$test_root/missing-source"
missing_prototype="$missing_root/prototype"
missing_movie="$missing_root/Absent Tahoe Day.mov"
missing_wallpaper="$missing_prototype/public/mac-assets/wallpapers/tahoe.jpg"
mkdir -p "${missing_wallpaper:h}"
print -r -- "stale wallpaper" >"$missing_wallpaper"
expected_missing_wallpaper=${missing_wallpaper:A}

env \
  TMPDIR="$runtime_root" \
  MAC_PROTOTYPING_PLATFORM=Darwin \
  MAC_PROTOTYPING_TAHOE_MOVIE="$missing_movie" \
  MAC_PROTOTYPING_FFMPEG_COMMAND="$tools_root/ffmpeg" \
  MAC_PROTOTYPING_QLMANAGE_COMMAND="$tools_root/qlmanage" \
  MAC_PROTOTYPING_SIPS_COMMAND="$tools_root/sips" \
  FAKE_SIPS_RESULT=success \
  "$hydrator" "$missing_prototype" >"$missing_root/stdout" 2>"$missing_root/stderr"

[[ ! -e "$missing_wallpaper" ]] || fail "missing source retained a stale Tahoe wallpaper"
assert_contains "$missing_root/stderr" "Tahoe Day wallpaper is unavailable on this macOS install ($missing_movie)"
assert_contains "$missing_root/stderr" "removed stale hydrated Tahoe wallpaper at $expected_missing_wallpaper"
assert_contains "$missing_root/stdout" "local asset hydration finished with"
assert_no_extraction_temporary_directories

missing_icon_root="$test_root/missing-optional-icon"
missing_icon_prototype="$missing_icon_root/prototype"
missing_chrome_source="$missing_icon_root/Absent Google Chrome.icns"
missing_icon_movie="$missing_icon_root/Absent Tahoe Day.mov"
missing_chrome_destination="$missing_icon_prototype/public/mac-assets/dock/chrome.png"
expected_chrome_destination="${missing_icon_prototype:A}/public/mac-assets/dock/chrome.png"

run_missing_icon_hydration() {
  local phase=$1

  env \
    TMPDIR="$runtime_root" \
    MAC_PROTOTYPING_PLATFORM=Darwin \
    MAC_PROTOTYPING_CHROME_ICON_SOURCE="$missing_chrome_source" \
    MAC_PROTOTYPING_TAHOE_MOVIE="$missing_icon_movie" \
    MAC_PROTOTYPING_FFMPEG_COMMAND="$tools_root/ffmpeg" \
    MAC_PROTOTYPING_QLMANAGE_COMMAND="$tools_root/qlmanage" \
    MAC_PROTOTYPING_SIPS_COMMAND="$tools_root/sips" \
    FAKE_SIPS_RESULT=success \
    "$hydrator" "$missing_icon_prototype" \
      >"$missing_icon_root/$phase-stdout" \
      2>"$missing_icon_root/$phase-stderr"
}

mkdir -p "${missing_chrome_destination:h}"
print -r -- "stale Chrome icon" >"$missing_chrome_destination"
run_missing_icon_hydration stale-file

[[ ! -e "$missing_chrome_destination" ]] || fail "missing Chrome source retained a stale icon"
assert_contains "$missing_icon_root/stale-file-stderr" "skipped Google Chrome icon (not found at $missing_chrome_source)"
assert_contains "$missing_icon_root/stale-file-stderr" "removed stale hydrated Google Chrome icon at $expected_chrome_destination"

/bin/ln -s "$missing_icon_root/nonexistent-icon-target" "$missing_chrome_destination"
run_missing_icon_hydration dangling-symlink

[[ ! -e "$missing_chrome_destination" && ! -L "$missing_chrome_destination" ]] || \
  fail "missing Chrome source retained a dangling hydrated icon symlink"
assert_contains "$missing_icon_root/dangling-symlink-stderr" "removed stale hydrated Google Chrome icon at $expected_chrome_destination"
assert_no_extraction_temporary_directories

icon_cleanup_failure_root="$test_root/icon-cleanup-failure"
icon_cleanup_failure_prototype="$icon_cleanup_failure_root/prototype"
icon_cleanup_failure_destination="$icon_cleanup_failure_prototype/public/mac-assets/dock/chrome.png"
mkdir -p "$icon_cleanup_failure_destination"

if env \
  TMPDIR="$runtime_root" \
  MAC_PROTOTYPING_PLATFORM=Darwin \
  MAC_PROTOTYPING_CHROME_ICON_SOURCE="$icon_cleanup_failure_root/Absent Google Chrome.icns" \
  MAC_PROTOTYPING_TAHOE_MOVIE="$icon_cleanup_failure_root/Absent Tahoe Day.mov" \
  MAC_PROTOTYPING_SIPS_COMMAND="$tools_root/sips" \
  FAKE_SIPS_RESULT=success \
  "$hydrator" "$icon_cleanup_failure_prototype" \
    >"$icon_cleanup_failure_root/stdout" \
    2>"$icon_cleanup_failure_root/stderr"; then
  fail "missing icon source succeeded after stale destination cleanup failed"
else
  icon_cleanup_failure_status=$?
fi

[[ "$icon_cleanup_failure_status" -eq 74 ]] || \
  fail "icon cleanup failure returned $icon_cleanup_failure_status instead of 74"
assert_contains "$icon_cleanup_failure_root/stderr" "could not remove stale hydrated Google Chrome icon"

run_atomic_icon_failure_case() {
  local name=$1
  local sips_result=$2
  local expected_status=$3
  local expected_diagnostic=$4
  local case_root="$test_root/$name"
  local prototype="$case_root/prototype"
  local chrome_source="$case_root/Google Chrome.icns"
  local chrome_destination="$prototype/public/mac-assets/dock/chrome.png"
  local before_checksum
  local after_checksum
  local run_status

  mkdir -p "${chrome_destination:h}"
  print -r -- "source icon" >"$chrome_source"
  printf "\211PNG\r\n\032\n%s\n" "prior valid Chrome icon" >"$chrome_destination"
  before_checksum=$(/usr/bin/cksum "$chrome_destination")

  if env \
    TMPDIR="$runtime_root" \
    MAC_PROTOTYPING_PLATFORM=Darwin \
    MAC_PROTOTYPING_CHROME_ICON_SOURCE="$chrome_source" \
    MAC_PROTOTYPING_TAHOE_MOVIE="$case_root/Absent Tahoe Day.mov" \
    MAC_PROTOTYPING_SIPS_COMMAND="$tools_root/sips" \
    FAKE_SIPS_RESULT="$sips_result" \
    FAKE_SIPS_FAIL_INPUT="$chrome_source" \
    "$hydrator" "$prototype" >"$case_root/stdout" 2>"$case_root/stderr"; then
    fail "$name unexpectedly succeeded"
  else
    run_status=$?
  fi

  [[ "$run_status" -eq "$expected_status" ]] || \
    fail "$name returned $run_status instead of $expected_status"
  after_checksum=$(/usr/bin/cksum "$chrome_destination")
  [[ "$after_checksum" == "$before_checksum" ]] || fail "$name replaced or truncated the prior valid icon"
  assert_contains "$case_root/stderr" "$expected_diagnostic"
  assert_no_extraction_temporary_directories
}

run_atomic_icon_failure_case \
  icon-sips-truncate-failure \
  truncate-failure \
  25 \
  "Google Chrome icon conversion failed (exit 25); preserved existing asset"

run_atomic_icon_failure_case \
  icon-invalid-success \
  invalid-success \
  74 \
  "Google Chrome icon conversion produced an invalid PNG; preserved existing asset"

print "hydrate-macos-assets.test: passed"
