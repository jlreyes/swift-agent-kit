# Debug a native Mac app through LLDB MCP

Use this how-to when LLDB owns the app's debug session. For an app already
running under Xcode's debugger, keep that owner and use Xcode's debugger tools.
See [session ownership](lldb-session-ownership.md) for the choice.

On November 12, 2026, this flow was exercised on a SwiftUI Mac todo app:
Add and Complete actions, Swift model expressions, source stepping, and
reconnection through the bundled `lldb-mcp` adapter. See the
[tool reference](lldb-mcp-reference.md) for tested versions and limitations.

## Prepare the app and debugger

Use a Debug build with symbols, matching source, and the Xcode toolchain that
built it. With a copied build, keep its matching `.dSYM` alongside the app.
A different Swift compiler may read DWARF variables while failing to evaluate
Swift expressions. Optimized builds may omit variables or rearrange steps.

Open a terminal you will retain throughout the session:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun lldb --no-lldbinit /path/to/Todo.app/Contents/MacOS/Todo
```

For a remote Mac, allocate a terminal **on that Mac**:

```sh
ssh -tt debug-host \
  'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun lldb --no-lldbinit /path/to/Todo.app/Contents/MacOS/Todo'
```

A local PTY is insufficient if SSH gives remote LLDB only pipes. The MCP
adapter connection uses ordinary stdio and does not need a PTY.

If needed, load the copied symbols and map the build machine's source path to
its current location:

```text
(lldb) target symbols add /path/to/Todo.app.dSYM
(lldb) settings set target.source-map /original/build/source /current/source
```

On a Mac that reports `non-interactive debug session, cannot get permission to
debug processes`, have its owner authorize normal developer debugging access.
`DevToolsSecurity -status` checks that setting; an authorized administrator can
use `sudo DevToolsSecurity -enable`. Resolve signing and attach permissions
through the normal macOS development setup. Keep SIP enabled.

## Stop in the action and connect MCP

Choose an executable source line inside your model's action, before its
mutation. For example, set a breakpoint at the first statement in
`TodoStore.add()`:

```text
(lldb) breakpoint set --file TodoStore.swift --line <action-line>
(lldb) run
```

Type a todo using the app's real keyboard input and press Add. Confirm LLDB
stopped at the intended breakpoint. Start its MCP server at this first real
stop:

```text
(lldb) protocol-server start MCP
(lldb) protocol-server get MCP
```

LLDB reports a local listener. In the native test, starting the server before
launch sometimes left MCP commands without a current process; the cause remains
unexplained.

Start the bundled adapter **on the same Mac**, after the listener exists. An
MCP client configuration can use:

```json
{
  "command": "xcrun",
  "args": ["lldb-mcp"],
  "env": {"DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer"}
}
```

For a remote Mac, use a separate stdio SSH connection:

```json
{
  "command": "ssh",
  "args": ["-T", "debug-host", "DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun lldb-mcp"]
}
```

Enumerate the live tools and call `debugger_list` on the tested Apple build.
Select the returned debugger explicitly when multiple sessions exist. See the
[tool reference](lldb-mcp-reference.md) for the version difference and calls.

## Inspect SwiftUI model state

At the breakpoint, use `thread backtrace` and `frame info` to confirm the
selected frame is your model method, reached from the SwiftUI action. For an
`@MainActor @Observable` store, stay in that main-actor method while inspecting
its state.

Pass these strings to the MCP `command` tool:

```text
frame variable self
expression -l Swift -- self.draft
expression -l Swift -- self.items.count
expression -l Swift -- self.items.last?.completed
```

Replace the properties with your model's names. In the tested store, Observation
created backing storage named `_draft` and `_items`, so these also exposed raw
stored values:

```text
frame variable self._draft
frame variable self._items
```

The backing names are implementation details. Prefer Swift expressions for
model properties; inspect raw storage when an expression fails. Expression
evaluation executes code in the stopped process; keep it to small reads whose
getters you understand.

Accessibility values and the SwiftUI view tree describe the UI; they do not
prove the model received an edit. In the native test, an accessibility value-setting call changed the displayed text while
`draft` stayed empty. Real keyboard input changed the model, and the Add
breakpoint then showed the expected value. This recipe inspects reachable
application model state; it is not universal reflection of arbitrary SwiftUI
`@State` storage.

## Step across a change and resume

For a bounded source step, use synchronous debugger mode:

```text
script lldb.debugger.SetAsync(False)
thread step-over
expression -l Swift -- self.items.count
```

Repeat a step only while its location is useful. The todo test showed the
count increase after `items.append(...)`; a second action showed
`self.items.last?.completed` change from `false` to `true`.

Return to asynchronous mode before resuming an app that should remain running:

```text
script lldb.debugger.SetAsync(True)
continue
```

Continue promptly after inspecting main-actor state, then verify the visible
result in the app. A paused main thread cannot respond to UI automation. An
accessibility action may time out after hitting a breakpoint even though it
landed; check the debugger stop and resumed UI before retrying the action.

## Reconnect and finish

Keep the terminal-owned LLDB alive if the MCP client disconnects. Restart the
adapter after a new listener starts: discovery occurs when `lldb-mcp` starts.
List debuggers again; do not reuse a selector from another LLDB process. A fresh
adapter reconnected to the paused native test session and continued inspecting
and stepping the same live model.

When finished, remove your breakpoints. Use `process kill` for a disposable app
you launched, or `process detach` when the app should keep running. Stop the
listener with `protocol-server stop MCP`, then `quit` LLDB and close the
adapter. Clean LLDB exit removed its discovery record in the native test.
For stale records or a hanging Python command, use the
[troubleshooting reference](lldb-mcp-reference.md#troubleshooting).
