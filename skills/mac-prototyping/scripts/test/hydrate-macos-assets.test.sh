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
  local leftovers=("$runtime_root"/mac-prototyping-assets.*(N))

  (( ${#leftovers} == 0 )) || fail "wallpaper extraction temporary directory was not removed"
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
if [ "${FAKE_SIPS_RESULT:-success}" = "failure" ]; then
  exit 25
fi
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
cp "$input" "$output"'

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

print "hydrate-macos-assets.test: passed"
