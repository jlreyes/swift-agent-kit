# LLDB MCP and device CLI

Use these paths when their session ownership fits the task. They complement
the Xcode MCP server; they do not replace its shared debugger for an
Xcode-owned run.

## LLDB-owned MCP session

The installed Xcode 27 LLDB completed a target-free MCP probe. Its listener
exposed two tools: `command` (a command string and optional debugger selector)
and `debugger_list`. The probe selected debugger `1` with both `"1"` and
`lldb-mcp://debugger/1`; `version` returned the installed LLDB version and
`target list` correctly reported no targets.

Start an interactive listener:

```text
xcrun lldb --no-lldbinit
(lldb) protocol-server start MCP
```

LLDB reports a loopback port. Configure an MCP client as a stdio process that
bridges to that port, keeping the LLDB process open for the lifetime of the
connection:

```json
{
  "command": "/usr/bin/nc",
  "args": ["127.0.0.1", "<reported-port>"]
}
```

When finished, run `protocol-server stop MCP` and quit LLDB. The
`lldb://debugger/1` resource URI is not a debugger selector for `command`;
use the numeric selector or the `lldb-mcp://debugger/1` URI. `xcrun lldb-mcp`
is the intended native adapter, but this host's probe found stale local
discovery state and could not use it. Do not prescribe that adapter until it
works for the target environment.

This probe did not launch or attach an application. Before debugging a real
target, verify target selection, permissions, and cleanup in that project.

## `devicectl` command surfaces

The commands below are verified from installed Xcode 27 help, not exercised
against a device. Substitute a device identifier for `<device>` and inspect
each command's help for platform restrictions.

```sh
xcrun devicectl device capture screenshot --device <device> --destination screenshot.png
xcrun devicectl device capture screen-record --device <device> --destination recording.mp4 --duration 10
xcrun devicectl device orientation get --device <device> --json-output -
xcrun devicectl device orientation set --device <device> landscapeLeft
xcrun devicectl device process openURL --device <device> 'myapp://route'
xcrun devicectl device process sendMemoryWarning --device <device> --pid <pid>
```

`devicectl` also documents pasteboard operations and biometrics, location, and
status-bar simulation. Many commands support `--json-output -`, which directs
human-readable status to stderr; commands that produce binary data or bridged
remote stdout can reject stdout JSON. Use a JSON file for those cases rather
than assuming every command can stream structured output.

These are newly inventoried command surfaces, not claims that they were added
in Xcode 27. Validate behavior on the intended device or simulator before
making them part of an automated verification flow.
