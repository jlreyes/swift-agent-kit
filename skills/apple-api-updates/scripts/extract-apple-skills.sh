#!/bin/bash
# Kept inside the skill so both plugin and flat skills.sh installs carry it.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec /usr/bin/python3 "$SCRIPT_DIR/extract-apple-skills.py" "$@"
