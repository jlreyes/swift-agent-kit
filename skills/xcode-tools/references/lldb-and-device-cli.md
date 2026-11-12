# LLDB MCP and device CLI

For an LLDB-owned native Mac session, use the
[native debugging how-to](native-debugging.md),
[LLDB MCP reference](lldb-mcp-reference.md), and
[session ownership explanation](lldb-session-ownership.md).
The Xcode 27.2 follow-up exercised a real SwiftUI app, model expressions,
source stepping, and reconnection through the bundled adapter.

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
