---
name: xcode-tools
description: >-
  Operating guide for Xcode 27's bundled MCP server (mcpbridge): when to use
  each mcp__xcode-tools__* tool versus the agent's native tools or the CLI,
  connection setup and repair, output-noise control, and the tools that are
  genuinely unique (live per-file diagnostics, the shared lldb session,
  preview rendering, project-membership file operations, device driving).
  Use whenever xcode-tools MCP tools are available and an Xcode project is
  involved — including building, running, testing, debugging, rendering
  previews, or driving the simulator — before reaching for any
  mcp__xcode-tools__* tool, or when those tools are missing or erroring.
compatibility: Requires macOS with Xcode 27+ and the xcode-tools MCP server registered with the agent. Xcode 27's service can start on demand; project-scoped operations require a workspace and may request agent or folder approval.
metadata:
  author: jlreyes
  source: Xcode 27.0 (27A266a) headless schema inventory, 2026-09; retained beta probes from 27A5194q, 2026-06
---

# Driving Xcode from Claude Code

Working model: **Claude Code is the editor; Xcode is a build/run/debug/docs
service.** Xcode 27 can start its MCP service on demand, including without an
open workspace. Open or select a workspace before project operations. Never
assume the Xcode UI state (current file, selection) means anything unless
asked about it, and remember some calls mutate state the *human* also sees
(run destination, debugger, simulator).

Per-tool verdicts and nuances: `references/tool-reference.md`.

## Session bootstrap (once per workspace)

1. In Xcode 27 headless mode, call `XcodeListWorkspaces` or
   `XcodeOpenWorkspace` and retain its `workspaceIdentifier`. It accepts a
   `workspaceN` handle or an absolute workspace path. A permission request is
   expected when an agent first accesses a directory; do not work around it.
2. The UI-attached beta path used `XcodeListWindows` and `tabIdentifier`.
   Those UI-only tools were not present in the release headless probe, but
   were not verified removed. Use them only when the server exposes them.
3. Only if you'll build/run: confirm the destination via the
   `activeDestinationDisplayTitle` field of `XcodeSwitchScheme`/`…Destination`
   responses — do NOT call `XcodeListRunDestinations` (15KB) unless you
   actually need to change OS/device class.

Pass `workspaceIdentifier` to project tools when more than one workspace is
available or when operating headlessly. The live schema is authoritative: the
server advertises `tools.listChanged`, so enumerate tools and read schemas
rather than treating this guide's count as a contract.

## Division of labor — native tools vs xcode-tools vs CLI

The broad routing remains useful. Detailed behavioral claims, performance
figures, and edge cases from the June beta probe are dated in the reference;
prefer the current schema when they disagree.

The project type matters: in **SwiftPM packages** (Package.swift),
membership is the folder layout — native file tools do everything. In an
**.xcodeproj**, inspect how the group is configured. Files in explicit pbxproj
membership need Xcode-aware lifecycle operations; synchronized folders follow
the filesystem and can use native file tools.

| Job | Use | Don't use | Why |
|---|---|---|---|
| Read file contents | native Read | XcodeRead | same bytes without the MCP hop or JSON-escaped payload |
| Search/list source | native Grep/Glob | XcodeGrep/Glob/LS | faster; content is content |
| Edit existing file | native Edit | XcodeUpdate | Edit errors on ambiguous match; XcodeUpdate silently edits the FIRST occurrence |
| Create file (explicit .xcodeproj membership) | XcodeWrite | native Write | registers it in project/target; native Write can orphan it |
| Delete/rename/move (explicit .xcodeproj membership) | XcodeRM / XcodeMV | native rm/mv | keeps pbxproj references consistent; RM trashes (recoverable) |
| Any file op (SwiftPM pkg) | native tools | Xcode file tools | folder = membership |
| Group structure / target membership questions | XcodeLS, GetTargetBuildSettings | guessing from disk | groups ≠ folders |
| "What is the user looking at?" | XcodeGetCurrentFile | — | only source of editor focus when the server exposes this UI-attached tool; `{"isEditable":false}` = nothing focused |
| One-file compile check | XcodeRefreshCodeIssuesInFile | building | no build artifacts touched; sees more than the compiler emits (but ~7–10s — a warm incremental BuildProject can be faster) |
| Full build | BuildProject | shelling to xcodebuild | quiet by design (summary + log file); CLI only for clean builds / flag overrides / CI parity |
| Run tests (.xcodeproj / simulator) | RunSomeTests / RunAllTests | xcodebuild test | structured counts + .xcresult, self-building |
| Run tests (SwiftPM) | `swift test` CLI | MCP test tools | no scheme/simulator needed; CLI is leaner |
| Debug an Xcode-owned run | RunProject(attachDebugger:true) → InvokeDebuggerCommand | external LLDB session | shares Xcode's debug-console session; use separate LLDB MCP only for an intentionally LLDB-owned session |
| App stdout/print + OSLog of an Xcode-launched run | GetConsoleOutput | `log show` | print/stdout never reaches unified logging; session-scoped |
| Logs of a process YOU launched via CLI | `log show`/`log stream` | GetConsoleOutput | it only sees Xcode launch sessions |
| Visual check of a SwiftUI view | RenderPreview | building+screenshot rituals | renders #Preview to PNG, ~25–30s, no simulator interaction |
| Try an idea in project context | RunCodeSnippet | scratch files | sees the file's types; stdout-only output |
| Build settings / Info.plist / entitlements | the MCP setting tools | editing pbxproj/plist by hand | validated, reference-safe (entitlements are checked against a real database) |
| String Catalog work | StringCatalog* tools | native Edit of .xcstrings | tools maintain the translation state machine + extraction sync |
| Apple docs lookup | see the `apple-docs` skill's routing section | — | DocumentationSearch is discovery, NOT an existence check |
| iOS UI driving (tap/type/screenshot) | DeviceInteraction* suite | — | begin with `DeviceInteractionStartWorkspaceSession` in the release schema; read its live requirements before choosing a target |

## What only this server gives you

The performance and behavioral details in this list are June 2026 beta
observations. Check the current schema before depending on them.

1. **`XcodeRefreshCodeIssuesInFile`** — live sourcekit diagnostics with no
   build, seeing more than the compiler emits. Not instant (~7–10s
   observed): prefer it when a build is undesirable; on warm small
   projects an incremental BuildProject is both faster and authoritative.
2. **`InvokeDebuggerCommand`** — a real lldb into the running app, sharing
   Xcode's debug-console session. Etiquette: the human sees your commands;
   `process interrupt` before expressions, `continue` promptly, remove any
   breakpoints you set.
3. **`RenderPreview`** — compile-and-snapshot any `#Preview` to a PNG.
4. **Membership-aware file ops** for .xcodeproj projects.
5. **`DeviceInteractionSynthesize`** — the June beta probe supported
   taps/swipes/typing plus screenshot, UI hierarchy, and app stderr per call.
   Read the current schema before making platform or runtime assumptions.
6. **Crash/field-performance services** — Apple's field data + triage docs,
   for apps connected in Organizer (pass `bundle_id` explicitly; the
   auto-resolution claim is false in practice).

## Verification ladder (June beta observations — check current timings)

1. `BuildProject` — authoritative compile+link; self-reports `elapsedTime`
   (0.1s null build, ~4s small warm compile). On warm projects this is
   usually the cheapest real check.
2. `XcodeRefreshCodeIssuesInFile` — per-file, no build artifacts, catches
   hallucinated APIs and more diagnostics than the compiler (~7–10s).
   Misses cross-file/link breaks.
3. `RunCodeSnippet` — behavior probe in project context (~15–25s).
4. `RunSomeTests` → `RunAllTests` — highest signal; ~14s with a warm
   simulator, 45s+ cold. Once the sim is booted, tests are cheap — use them.

## Token cost & noise control

The response sizes and defaults in this section are June beta measurements;
recheck a changed schema before using them as a budget.

Most responses are pre-quieted summaries; the xcodebuild firehose goes to
artifact files (`/var/folders/…/T/ActionArtifacts/default/<Tool>/…`) — grep
those, never read linearly. The exceptions to watch:

| Offender | Cost | Mitigation |
|---|---|---|
| GetTargetBuildSettings | ~26KB inline, no filter | fetch via subagent, or accept once and extract what you need |
| DocumentationSearch | ~30KB/query (~12KB with `frameworks` filter) | filter + precise queries; it's vocabulary discovery, not lookup |
| XcodeListRunDestinations | ~15KB | avoid; read active destination from switch-tool responses |
| GetConsoleOutput | 500-line default tail | `pattern` + `oslogSeverity` + small `tailLimit` |

Gotcha: `GetBuildLog` and `XcodeListNavigatorIssues` default to
`severity:"error"` — a warnings-only build looks empty until you pass
`severity:"warning"`.

## Release additions and compatibility

The warm Xcode 27.0 (27A266a) headless inventory has 54 tools. Ten names were
absent from the kit's 47-name beta inventory: `DeviceInteractionStartWorkspaceSession`,
`XcodeCloseWorkspace`, `XcodeListTargets`, `XcodeListTemplates`,
`XcodeListTestPlans`, `XcodeListWorkspaces`, `XcodeNewProject`,
`XcodeNewTarget`, `XcodeOpenWorkspace`, and `XcodeSwitchTestPlan`. Three
beta UI tools (`XcodeGetCurrentFile`, `XcodeListNavigatorIssues`, and
`XcodeListWindows`) were absent from that headless list, not established as
removed. `DocumentationSearch` appeared after service warm-up, so never make
availability decisions from a single early enumeration.

`DeviceInteractionStartSession` is workspace-free and cannot build or install.
For a project run and device interaction, use
`DeviceInteractionStartWorkspaceSession` with the workspace selector; its
subsequent `DeviceInteractionSynthesize` parameter remains spelled
`interactSessionKey`. `BuildProject` accepts `buildForTesting`, and
`DeviceInteractionSynthesize` accepts `activationBundleId`. Switching a test
plan persists in the scheme.

## LLDB MCP and device CLI

The installed LLDB MCP listener and `devicectl` command surfaces are documented
in [LLDB and device CLI](references/lldb-and-device-cli.md). The LLDB probe was
target-free, and the device commands are help-verified only; use the live
schemas and command help before depending on either in an automated flow.

## Failure modes & repair

| Symptom | Cause → fix |
|---|---|
| Project tool asks for approval | the agent or folder has not yet been approved → request the scoped approval, then retry |
| Headless service unavailable | inspect `xcrun mcp-server status`; when service setup is authorized, enable it with `sudo xcrun mcp-server enable` using normal admin approval, then reconnect. Do not alter permission grants outside authorized scope or use unsafe allow-all approval by default. |
| UI-only tool absent | headless server or a changed tool inventory → use `XcodeListWorkspaces`/`workspaceIdentifier` where applicable; read the live schema |
| Wrong Xcode answering | June beta workaround: set `MCP_XCODE_PID=<pid>` in server env; confirm it still applies before relying on it |
| Device tools: `Supported: iOS [Simulator] 27.0+` | June beta observation: install that runtime; check the current device-tool schema for platform support |
| Hard MCP error `{"type":"error","data":…}` vs result with `success:false` | June beta observation: two error envelopes; inspect both while confirming the current schema |

Setup (one-time):

```bash
claude mcp add --scope user xcode-tools \
  -- xcrun mcpbridge
```
