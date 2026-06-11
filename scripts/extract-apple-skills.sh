#!/bin/bash
# Thin wrapper (plugin layout): the real script ships inside the
# apple-api-updates skill so skills.sh installs carry it too.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/skills/apple-api-updates/scripts/extract-apple-skills.sh" "$@"
