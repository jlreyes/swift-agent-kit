#!/usr/bin/env python3
"""PreToolUse hook: ask once for the Swift skills before Swift is written.

The first Swift write of a session, or of a subagent in it, is refused if
swift-standards has not been loaded, and the refusal names the skill. A write
that contains `import SwiftUI` gets the same check for swiftui-specialist.
Each skill is asked for once: later writes go through whether or not it was
loaded. SWIFT_AGENT_KIT_GATE=off turns the check off, and any error lets the
tool call through.
"""
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time

STANDARDS = "swift-standards"
SWIFTUI = "swiftui-specialist"
NAMESPACE = "swift-agent-kit:"
MESSAGES = {
    (STANDARDS,): "swift-agent-kit: this write was refused because swift-standards is not loaded. Load it, then retry. Each skill is asked for once per session.",
    (SWIFTUI,): "swift-agent-kit: this write was refused because swiftui-specialist is not loaded. Load it before writing SwiftUI views, then retry. Each skill is asked for once per session.",
    (STANDARDS, SWIFTUI): "swift-agent-kit: this write was refused because swift-standards is not loaded. Load it, and swiftui-specialist too for SwiftUI views, then retry. Each skill is asked for once per session.",
}
# Writes issued in the same turn as a refused one reach the hook within this
# many seconds of it, and are refused with it.
SAME_TURN_SECONDS = 15
FILE_TOOLS = ("Write", "Edit", "MultiEdit")
XCODE_FILE_TOOLS = ("__XcodeWrite", "__XcodeUpdate")
# A redirect or `tee` into a path that ends in `.swift`. The lookbehind keeps
# `->` and `=>` in prose from reading as redirects; the lookahead keeps
# `.swift-version` and `.swiftlint.yml` from reading as Swift files.
SHELL_SWIFT_WRITE = re.compile(r"""
    (?: (?<![-=\w]) >{1,2} \s*
      | \b tee \s+ (?: -a \s+ )?
    )
    ["']? [^\s"'<>|;&]* [^\s"'<>|;&-] \.swift (?![\w.-])
""", re.VERBOSE)


def swift_written(tool, tool_input):
    """Return the text of a call that writes a .swift file, or None for any other call."""
    if tool in FILE_TOOLS or tool.endswith(XCODE_FILE_TOOLS):
        target = tool_input.get("file_path") or tool_input.get("filePath") or tool_input.get("path") or ""
        return json.dumps(tool_input) if str(target).endswith(".swift") else None
    if tool == "Bash":
        command = str(tool_input.get("command", ""))
        return command if SHELL_SWIFT_WRITE.search(command) else None
    return None


def marker(call, skill, fact):
    """Path of the empty file that records one fact about a skill for this session and agent."""
    owner = "{}-{}".format(call.get("session_id", "none"), call.get("agent_id", "main"))
    directory = Path(tempfile.gettempdir()) / "swift-agent-kit-gate"
    directory.mkdir(exist_ok=True)
    return directory / (re.sub(r"[^\w-]", "_", owner) + "." + skill + "." + fact)


def due(call, skill, now):
    """True while a skill is not loaded and was not asked for before this turn."""
    if marker(call, skill, "loaded").exists():
        return False
    try:
        return now - marker(call, skill, "asked").stat().st_mtime < SAME_TURN_SECONDS
    except FileNotFoundError:
        return True


def main():
    if os.environ.get("SWIFT_AGENT_KIT_GATE", "").lower() in ("off", "0", "false"):
        return
    call = json.load(sys.stdin)
    tool = call.get("tool_name", "")
    tool_input = call.get("tool_input") or {}
    if tool == "Skill":
        name = str(tool_input.get("skill", ""))
        if name.startswith(NAMESPACE):
            name = name[len(NAMESPACE):]
        if name in (STANDARDS, SWIFTUI):
            marker(call, name, "loaded").touch()
        return
    text = swift_written(tool, tool_input)
    if text is None:
        return
    wanted = (STANDARDS, SWIFTUI) if "import SwiftUI" in text else (STANDARDS,)
    now = time.time()
    missing = tuple(skill for skill in wanted if due(call, skill, now))
    if not missing:
        return
    # Record the ask before refusing. If it cannot be recorded, the error lets
    # the write through instead of refusing every retry.
    for skill in missing:
        try:
            marker(call, skill, "asked").touch(exist_ok=False)
        except FileExistsError:
            pass  # Asked for earlier in this turn; the first time stands.
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": MESSAGES[missing],
    }}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # A failing check must not block the tool call.
    sys.exit(0)
