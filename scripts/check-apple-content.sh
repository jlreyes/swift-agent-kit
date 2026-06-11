#!/bin/bash
# SessionStart hook: nudge (agent + user) until Apple content is extracted.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
if [ ! -f "$ROOT/skills/.apple-content-extracted" ]; then
  echo "swift-agent-kit: Apple's ten Xcode skills are stubs until extracted from your local Xcode (Apple's license doesn't permit redistributing them). Run: \"$ROOT/scripts/extract-apple-skills.sh\" (needs Xcode 27+, ~5s). The kit's own skills (swift-standards, apple-docs, xcode-tools, apple-api-updates routing) work now. This notice disappears after extraction."
fi
exit 0
