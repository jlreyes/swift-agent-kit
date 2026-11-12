"""Runs the registered PreToolUse hook command on hook-input JSON, with its state in a temporary directory."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

REPOSITORY = Path(__file__).resolve().parents[1]
HOOKS = json.loads((REPOSITORY / "hooks/hooks.json").read_text())
STANDARDS = "swift-agent-kit: this write was refused because swift-standards is not loaded. Load it, then retry. Each skill is asked for once per session."
SWIFTUI = "swift-agent-kit: this write was refused because swiftui-specialist is not loaded. Load it before writing SwiftUI views, then retry. Each skill is asked for once per session."
BOTH = "swift-agent-kit: this write was refused because swift-standards is not loaded. Load it, and swiftui-specialist too for SwiftUI views, then retry. Each skill is asked for once per session."
PLAIN = "struct Point { var x = 0 }\n"
VIEW = "import SwiftUI\n\nstruct ContentView: View { var body: some View { Text(\"Hi\") } }\n"


def write(path="Sources/App/Point.swift", content=PLAIN):
    return "Write", {"file_path": path, "content": content}


def bash(command):
    return "Bash", {"command": command}


def skill(name):
    return "Skill", {"skill": name}


class GateTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.environment = dict(os.environ, CLAUDE_PLUGIN_ROOT=str(REPOSITORY), TMPDIR=self.temporary.name)
        self.environment.pop("SWIFT_AGENT_KIT_GATE", None)

    def run_hook(self, stdin):
        command = HOOKS["hooks"]["PreToolUse"][0]["hooks"][0]["command"]
        result = subprocess.run(command, shell=True, input=stdin, env=self.environment, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")
        return result.stdout

    def call(self, tool, tool_input, session="session-1", agent=None):
        """Return the refusal message for one tool call, or None when it is let through."""
        payload = {"session_id": session, "hook_event_name": "PreToolUse", "tool_name": tool, "tool_input": tool_input}
        if agent:
            payload["agent_id"] = agent
        output = self.run_hook(json.dumps(payload))
        if not output:
            return None
        decision = json.loads(output)["hookSpecificOutput"]
        self.assertEqual(decision["hookEventName"], "PreToolUse")
        self.assertEqual(decision["permissionDecision"], "deny")
        return decision["permissionDecisionReason"]

    def elapse(self, seconds):
        """Age the recorded state as if this many seconds had passed."""
        for path in Path(self.temporary.name).rglob("*"):
            if path.is_file():
                status = path.stat()
                os.utime(path, (status.st_atime - seconds, status.st_mtime - seconds))

    def test_registration_adds_the_check_and_keeps_the_session_start_hook(self):
        self.assertEqual(HOOKS["hooks"]["SessionStart"], [{"matcher": "startup|resume", "hooks": [
            {"type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/check-apple-content.sh\"", "timeout": 10}]}])
        (entry,) = HOOKS["hooks"]["PreToolUse"]
        self.assertEqual(entry["matcher"], "Skill|Write|Edit|MultiEdit|Bash|mcp__.*__Xcode(Write|Update)")
        self.assertTrue((REPOSITORY / "scripts/swift-standards-gate.py").is_file())
        self.assertIn("\"${CLAUDE_PLUGIN_ROOT}/scripts/swift-standards-gate.py\"", entry["hooks"][0]["command"])

    def test_first_swift_write_is_refused_until_swift_standards_is_loaded(self):
        self.assertEqual(self.call(*write()), STANDARDS)
        self.assertIsNone(self.call(*skill("swift-agent-kit:swift-standards")))
        self.assertIsNone(self.call(*write()))

    def test_swiftui_write_names_each_skill_that_is_missing(self):
        self.assertEqual(self.call(*write(content=VIEW)), BOTH)
        self.assertIsNone(self.call(*skill("swift-standards")))
        self.assertEqual(self.call(*write(content=VIEW)), SWIFTUI)
        self.assertIsNone(self.call(*skill("swift-agent-kit:swiftui-specialist")))
        self.assertIsNone(self.call(*write(content=VIEW)))

    def test_skill_names_count_with_or_without_the_plugin_prefix(self):
        for standards, swiftui in (("swift-standards", "swiftui-specialist"), ("swift-agent-kit:swift-standards", "swift-agent-kit:swiftui-specialist")):
            with self.subTest(standards=standards):
                self.call(*skill(standards), session=standards)
                self.call(*skill(swiftui), session=standards)
                self.assertIsNone(self.call(*write(content=VIEW), session=standards))

    def test_other_skills_do_not_count(self):
        for name in ("swift-agent-kit:swiftui-whats-new-27", "swift-agent-kit:apple-docs", "other-plugin:swift-standards-notes"):
            self.call(*skill(name))
        self.assertEqual(self.call(*write(content=VIEW)), BOTH)

    def test_every_file_writing_tool_is_checked(self):
        calls = {
            "Write": {"file_path": "/work/App/Point.swift", "content": PLAIN},
            "Edit": {"file_path": "/work/App/Point.swift", "old_string": "x = 0", "new_string": "x = 1"},
            "MultiEdit": {"file_path": "/work/App/Point.swift", "edits": [{"old_string": "x = 0", "new_string": "x = 1"}]},
            "mcp__xcode-tools__XcodeWrite": {"filePath": "App/Point.swift", "content": PLAIN},
            "mcp__xcode-tools__XcodeUpdate": {"filePath": "App/Point.swift", "oldString": "x = 0", "newString": "x = 1"},
        }
        for tool, tool_input in calls.items():
            with self.subTest(tool=tool):
                self.assertEqual(self.call(tool, tool_input, session=tool), STANDARDS)
        nested = {"file_path": "/work/App/ContentView.swift", "edits": [{"old_string": "import Foundation", "new_string": "import SwiftUI"}]}
        self.assertEqual(self.call("MultiEdit", nested, session="nested"), BOTH)

    def test_shell_redirects_and_tee_into_swift_files_are_checked(self):
        commands = [
            "cat > Sources/App/main.swift <<'EOF'\nprint(1)\nEOF",
            "mkdir -p Sources && cat <<'EOF' > \"Sources/App.swift\"\nprint(1)\nEOF",
            "echo 'print(1)' >>Sources/main.swift",
            "printf 'print(1)\\n' | tee Sources/main.swift",
            "printf 'print(1)\\n' | tee -a 'Sources/main.swift' >/dev/null",
        ]
        for index, command in enumerate(commands):
            with self.subTest(command=command):
                self.assertEqual(self.call(*bash(command), session="shell-" + str(index)), STANDARDS)
        heredoc = "cat > ContentView.swift <<'EOF'\n" + VIEW + "EOF"
        self.assertEqual(self.call(*bash(heredoc), session="heredoc"), BOTH)

    def test_calls_that_do_not_write_swift_are_let_through(self):
        calls = [
            write("README.md", "Uses `import SwiftUI`.\n"),
            write(".swift-version", "6.2\n"),
            write(".swiftlint.yml", "disabled_rules: []\n"),
            ("Edit", {"file_path": "Package.resolved", "old_string": "a", "new_string": "b"}),
            ("mcp__xcode-tools__XcodeWrite", {"filePath": "App/Info.plist", "content": "<plist/>"}),
            ("Read", {"file_path": "Sources/App/Point.swift"}),
            bash("git commit -m \"Route Home -> Detail.swift and Old.swift => New.swift\""),
            bash("echo 6.2 > .swift-version"),
            bash("echo 6.2 > ./.swift-version"),
            bash("cat Sources/App/Point.swift > Point.swift.bak"),
            bash("swift build > build.log 2>&1"),
            bash("swift build 2>&1 | tee build.log"),
            bash("cat Sources/App/Point.swift"),
            bash("find . -name '*.swift' > files.txt"),
        ]
        for tool, tool_input in calls:
            with self.subTest(tool=tool, tool_input=tool_input):
                self.assertIsNone(self.call(tool, tool_input))
        self.assertEqual(self.call(*write()), STANDARDS)

    def test_each_skill_is_asked_for_once(self):
        self.assertEqual(self.call(*write()), STANDARDS)
        self.elapse(60)
        self.assertIsNone(self.call(*write()))
        self.assertEqual(self.call(*write(content=VIEW)), SWIFTUI)
        self.elapse(60)
        self.assertIsNone(self.call(*write(content=VIEW)))
        self.assertIsNone(self.call(*bash("cat > ContentView.swift <<'EOF'\n" + VIEW + "EOF")))

    def test_writes_issued_with_the_refused_one_are_refused_too(self):
        self.assertEqual(self.call(*write("Sources/App/Point.swift")), STANDARDS)
        self.assertEqual(self.call(*write("Sources/App/Line.swift")), STANDARDS)
        self.assertEqual(self.call(*write("Sources/App/ContentView.swift", VIEW)), BOTH)
        self.elapse(60)
        self.assertIsNone(self.call(*write("Sources/App/Line.swift")))
        self.assertIsNone(self.call(*write("Sources/App/ContentView.swift", VIEW)))

    def test_refusals_stop_fifteen_seconds_after_the_first_one(self):
        self.assertEqual(self.call(*write("Sources/App/Point.swift")), STANDARDS)
        self.elapse(10)
        self.assertEqual(self.call(*write("Sources/App/Line.swift")), STANDARDS)
        self.elapse(10)
        self.assertIsNone(self.call(*write("Sources/App/Line.swift")))

    def test_sessions_and_subagents_are_tracked_separately(self):
        self.call(*skill("swift-agent-kit:swift-standards"))
        self.assertIsNone(self.call(*write()))
        self.assertEqual(self.call(*write(), session="session-2"), STANDARDS)
        self.assertEqual(self.call(*write(), agent="agent-1"), STANDARDS)
        self.call(*skill("swift-standards"), agent="agent-1")
        self.assertIsNone(self.call(*write(), agent="agent-1"))
        self.assertEqual(self.call(*write(), agent="agent-2"), STANDARDS)

    def test_gate_can_be_turned_off(self):
        self.environment["SWIFT_AGENT_KIT_GATE"] = "off"
        self.assertIsNone(self.call(*write(content=VIEW)))
        del self.environment["SWIFT_AGENT_KIT_GATE"]
        self.assertEqual(self.call(*write(content=VIEW)), BOTH)

    def test_unreadable_input_lets_the_call_through(self):
        for stdin in ("", "not json", "[]", "{\"tool_name\": \"Write\", \"tool_input\": \"text\"}"):
            with self.subTest(stdin=stdin):
                self.assertEqual(self.run_hook(stdin), "")

    def test_unwritable_state_lets_the_call_through(self):
        (Path(self.temporary.name) / "swift-agent-kit-gate").write_text("in the way")
        self.assertIsNone(self.call(*write(content=VIEW)))
        self.assertIsNone(self.call(*skill("swift-standards")))


if __name__ == "__main__":
    unittest.main()
