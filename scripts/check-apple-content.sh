#!/bin/bash
# SessionStart hook: refresh after Xcode upgrades or an incomplete installation.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
if ! "$ROOT/skills/apple-api-updates/scripts/extract-apple-skills.sh" --check >/dev/null 2>&1; then
  echo "swift-agent-kit: Apple's 16 skill entries need local extraction or refresh for the selected Xcode build. Run: \"$ROOT/scripts/extract-apple-skills.sh\" (requires Xcode 27). The kit's own skills work now. Extraction preserves the kit's aliases and adds Apple's supporting references and API guides."
fi
exit 0
