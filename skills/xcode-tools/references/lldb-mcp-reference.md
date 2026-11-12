# LLDB MCP reference

Verified November 12, 2026 with Xcode 27.2 (27B52), LLDB 2103.0.34.407, and
Swift 6.4.2 on a native Mac app. For the procedure, use
[Debug a native Mac app](native-debugging.md).

## Installed Apple tool contract

The tested listener and bundled adapter exposed these tools:

| Tool | Arguments | Result |
| --- | --- | --- |
| `debugger_list` | `{}` | Available debugger IDs and URIs |
| `command` | `command`: string; `debugger`: optional string | LLDB command output |

Example MCP tool-call arguments:

```json
{"name":"debugger_list","arguments":{}}
```

```json
{"name":"command","arguments":{"command":"process status","debugger":"1"}}
```

Use the ID or URI from the current listing. In the tested build, `"1"` and
`"lldb-mcp://debugger/1"` selected the same debugger. `lldb://debugger/1` did
not. Omitting `debugger` selected the first debugger. The schema has no
required-parameter list, but a useful `command` call needs the command string.

Current [upstream LLVM documentation](https://lldb.llvm.org/use/mcp.html)
describes a newer four-tool interface: `session_create`, `command`,
`sessions_list`, and `session_close`, with instance-qualified debugger URIs.
Those session tools were absent from the tested Apple build. Enumerate the
installed tools and use their schemas; do not substitute upstream names for
this build's `debugger_list`.

## Listener and execution commands

| LLDB command | Purpose |
| --- | --- |
| `protocol-server start MCP` | Start a listener on an available local port |
| `protocol-server get MCP` | Show the listener endpoint |
| `protocol-server stop MCP` | Stop this LLDB's listener |
| `process status` | Check whether the target is stopped or running |
| `thread backtrace` / `frame info` | Identify the stopped call path and frame |
| `frame variable self` | Inspect variables without a Swift expression |
| `expression -l Swift -- self.items.count` | Evaluate a model property in a Swift frame |
| `script lldb.debugger.SetAsync(False)` | Make bounded stepping wait for completion |
| `thread step-over` | Advance over the current source statement |
| `script lldb.debugger.SetAsync(True)` | Restore asynchronous execution |
| `continue` | Resume the target |

MCP returns debugger command output. It does not supply the app's stdout;
collect or redirect app output separately when needed.

## Troubleshooting

| Symptom | Check or action |
| --- | --- |
| Adapter cannot discover the listener | Run the adapter as the same user on the same Mac as LLDB, after the server starts. Restart the adapter to rediscover. |
| Command has no current process | Check `process status` in the owning terminal. The verified sequence starts the server after the first real breakpoint. |
| Swift expression fails but variables are visible | Match the app's Swift compiler, LLDB, `.dSYM`, and source; select a Swift frame. Check optimization before assuming MCP is at fault. |
| Launch says it cannot get permission to debug | Check normal macOS developer debugging permissions; see the how-to. |
| UI action times out while stopped | Inspect the breakpoint and resume before deciding whether to repeat the action. |
| Python command such as `script print(42)` hangs | Confirm the owning LLDB has a real local or remote PTY. The sampled piped-backend hang involved a Python output stream lock; it was not a JSON-line reader failure. |
| Adapter exits on an old discovery entry | Verify its owning PID and listener are gone, then remove only that confirmed stale entry under `~/.lldb`. Preserve live sessions' records. |

The sampled Python hang was released by a newline in LLDB's terminal and
avoided with a real remote PTY. An earlier `run` stall was not sampled, so its
cause remains unknown. [LLVM issue 223227](https://github.com/llvm/llvm-project/issues/223227)
reports related adapter auto-spawn stdio corruption and stale discovery files;
it does not establish that every hang has the same cause. In the tested route,
the interactive LLDB remains alive and the bundled adapter discovers it.
