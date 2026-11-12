# How LLDB MCP fits beside Xcode

A native Mac app has one debugger owner at a time. That owner determines where
breakpoints, selected threads, expressions, and process lifetime live.

For an Xcode-owned run, Xcode MCP provides access to Xcode's debugger session.
For an intentionally LLDB-owned run, the bundled LLDB MCP server exposes the
standalone debugger. The native Mac verification on November 12, 2026 tested
the standalone path; it did not validate Xcode MCP's `InvokeDebuggerCommand`.
Starting another debugger against the same process creates an ownership
conflict.

## Debugger, server, and adapter

The interactive `lldb` process owns the target and its debug state. Its MCP
protocol server accepts debugger commands over a local listener. The separate
`lldb-mcp` adapter discovers existing LLDB listeners and carries requests
between an MCP client's stdio transport and those listeners. Restarting the
adapter need not end the target's debug session while the owning LLDB remains
alive.

In the verified setup, LLDB has a real terminal on the debugger's Mac; the
adapter uses stdio as a machine protocol. In the tested piped backend, a Python command waited on a
stream lock held by LLDB's input thread. A real remote PTY avoided that sampled
hang; a terminal on the SSH client alone does not establish one remotely.

## Why the first breakpoint matters

The verified setup exposed MCP after the app reached a real source breakpoint.
At that point the target, process, thread, and Swift frame were established.
When the server started before launch, some commands reported no current
process despite a target being present. The test did not establish the cause,
so the how-to uses the sequence that worked.

## What state the debugger can show

LLDB can inspect a reachable model in a stopped Swift frame and evaluate Swift
expressions with a compatible compiler and symbols. For a main-actor
`@Observable` model, a breakpoint in the action that mutates it provides a
useful context: the actual instance, its current properties, and the source
statement about to run.

SwiftUI's accessibility tree answers a different question: what controls and
values the UI exposes. A visible text edit and a model mutation can disagree.
Neither accessibility nor this debugger recipe promises universal access to
SwiftUI's private `@State` representation. The
[native debugging how-to](native-debugging.md)
connects UI actions to model reads and verifies the rendered result after
resuming.
