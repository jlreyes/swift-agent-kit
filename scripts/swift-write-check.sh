#!/bin/bash
# PreToolUse entry point for the Swift standards check. Most tool calls have
# nothing to do with Swift, so decide that with shell builtins and exit before
# starting Python. Only a call that mentions a .swift path or one of the two
# skills reaches swift-standards-gate.py.
IFS= read -r -d '' input || true
case "$input" in
  *.swift*|*swift-standards*|*swiftui-specialist*) ;;
  *) exit 0 ;;
esac
exec /usr/bin/python3 "${0%/*}/swift-standards-gate.py" <<<"$input"
