#!/bin/bash
# Extracts Apple's Xcode 27 agent skills from YOUR local Xcode into this
# plugin, replacing the shipped stubs. Nothing is downloaded; no Apple
# content is redistributed — everything comes from the Xcode you installed.
#
# Requires: Xcode 27+ (license accepted). If the export step stalls, launch
# the Xcode app once and re-run. Idempotent; safe to re-run after Xcode or
# plugin updates.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKER="$ROOT/.apple-content-extracted"

# ── 1. Locate an Xcode 27+ with mcpbridge ───────────────────────────────────
find_dev() {
  local cands=()
  [ -n "${DEVELOPER_DIR:-}" ] && cands+=("$DEVELOPER_DIR")
  cands+=("$(xcode-select -p 2>/dev/null || true)")
  cands+=(/Applications/Xcode-beta.app/Contents/Developer /Applications/Xcode.app/Contents/Developer)
  for d in "${cands[@]}"; do
    [ -n "$d" ] && [ -x "$d/usr/bin/mcpbridge" ] && { echo "$d"; return 0; }
  done
  return 1
}
DEV="$(find_dev)" || { echo "error: no Xcode with mcpbridge found (needs Xcode 27+). Set DEVELOPER_DIR." >&2; exit 1; }
APP_CONTENTS="$(dirname "$DEV")"
XCODE_BUILD="$(DEVELOPER_DIR="$DEV" /usr/bin/xcrun xcodebuild -version 2>/dev/null | awk '/Build version/{print $3}')"
echo "Using Xcode at: $APP_CONTENTS (build ${XCODE_BUILD:-unknown})"

# ── 2. Official export: the 7 globally available skills ─────────────────────
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "Exporting skills via mcpbridge…"
DEVELOPER_DIR="$DEV" "$DEV/usr/bin/mcpbridge" run-agent skills export \
  --output-dir "$TMP/export" --replace-existing &
EXPORT_PID=$!
for _ in $(seq 1 60); do kill -0 "$EXPORT_PID" 2>/dev/null || break; sleep 1; done
if kill -0 "$EXPORT_PID" 2>/dev/null; then
  kill "$EXPORT_PID" 2>/dev/null || true
  echo "error: export stalled. Launch the Xcode app once, then re-run this script." >&2
  exit 1
fi
wait "$EXPORT_PID" || { echo "error: skills export failed." >&2; exit 1; }

EXPORTED=(swiftui-specialist swiftui-whats-new-27 uikit-app-modernization \
          c-bounds-safety audit-xcode-security-settings test-modernizer device-interaction)
for s in "${EXPORTED[@]}"; do
  if [ -d "$TMP/export/$s" ]; then
    rm -rf "$ROOT/skills/$s"
    cp -R "$TMP/export/$s" "$ROOT/skills/$s"
    echo "  ✓ $s"
  else
    echo "  ! $s missing from export (Xcode version mismatch?)" >&2
  fi
done

# ── 3. Translation pair: Apple body + this plugin's frontmatter ─────────────
# Apple ships these without frontmatter; we keep the stub's frontmatter
# (ours) and splice in Apple's body.
XSTR="$APP_CONTENTS/PlugIns/IDEXCStringsSupport.framework/Versions/A/Resources/Skills"
splice_translation() {
  local name="$1" src="$XSTR/$1"
  [ -d "$src" ] || { echo "  ! $name not found in IDEXCStringsSupport" >&2; return 0; }
  local stub="$ROOT/skills/$name/SKILL.md" out="$TMP/$name-SKILL.md"
  awk '/^---$/{c++} {print} c==2{exit}' "$stub" | grep -v '^  stub: ' > "$out"
  printf '\n' >> "$out"
  cat "$src/SKILL.md" >> "$out"
  rm -rf "$ROOT/skills/$name"
  cp -R "$src" "$ROOT/skills/$name"
  mv "$out" "$ROOT/skills/$name/SKILL.md"
  echo "  ✓ $name (body from IDEXCStringsSupport, frontmatter ours)"
}
splice_translation translation
splice_translation translation-coordinator

# ── 4. ios-dynamic-text: carved from the IDEAXSpecialist binary ─────────────
AXBIN="$APP_CONTENTS/PlugIns/IDEAXSpecialist.framework/Versions/A/IDEAXSpecialist"
if [ -f "$AXBIN" ]; then
  /usr/bin/python3 - "$AXBIN" "$ROOT/skills/ios-dynamic-text/SKILL.md" <<'PYEOF'
import re, sys
binpath, outpath = sys.argv[1], sys.argv[2]
data = open(binpath, 'rb').read()
for m in re.finditer(b'ios-dynamic-text', data):
    h = m.start()
    if b'name:' in data[max(0, h-20):h]:
        start = data.rfind(b'\x00', 0, h) + 1
        end = data.find(b'\x00', h)
        blob = data[start:end].decode('utf-8', errors='replace')
        if blob.startswith('---'):
            open(outpath, 'w').write(blob)
            print('  ✓ ios-dynamic-text (carved from IDEAXSpecialist)')
            sys.exit(0)
print('  ! ios-dynamic-text not found in binary (layout changed?)', file=sys.stderr)
PYEOF
else
  echo "  ! IDEAXSpecialist binary not found; skipping ios-dynamic-text" >&2
fi

# ── 5. apple-api-updates references: Xcode's curated API-update guides ──────
DOCS="$APP_CONTENTS/PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation"
if [ -d "$DOCS" ]; then
  cp "$DOCS"/*.md "$ROOT/skills/apple-api-updates/references/"
  echo "  ✓ apple-api-updates/references ($(ls "$DOCS"/*.md | wc -l | tr -d ' ') guides)"
else
  echo "  ! AdditionalDocumentation not found" >&2
fi

# ── 6. Marker ────────────────────────────────────────────────────────────────
printf 'xcode_build=%s\nextracted_at=%s\n' "${XCODE_BUILD:-unknown}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MARKER"
echo
echo "Done. Extracted from Xcode build ${XCODE_BUILD:-unknown}."
echo "Active sessions pick up extracted skill bodies immediately;"
echo "run /reload-plugins (or start a new session) to refresh skill listings."
