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
compatibility: Requires macOS with Xcode 27+ running and a project open; the xcode-tools MCP server registered with the agent.
metadata:
  author: jlreyes
  source: empirical probing of Xcode 27.0 beta (27A5194q) mcpbridge, 2026-06 (90+ live calls)
---

# Driving Xcode from Claude Code

Working model: **Claude Code is the editor; Xcode is an attached
build/run/debug/docs service.** The user is not editing in Xcode — it's open
so its services are reachable. Never assume the Xcode UI state (current file,
selection) means anything unless asked about it, and remember some calls
mutate state the *human* also sees (run destination, debugger, simulator).

Per-tool verdicts and nuances: `references/tool-reference.md`.

## Session bootstrap (once per session)

1. `XcodeListWindows` → parse `tabIdentifier` from the `message` text; match
   on `workspacePath` if several windows. No workspace open → everything else
   is unusable; ask the user or `open -a Xcode-beta <path>.xcodeproj`.
2. Only if you'll build/run: confirm the destination via the
   `activeDestinationDisplayTitle` field of `XcodeSwitchScheme`/`…Destination`
   responses — do NOT call `XcodeListRunDestinations` (15KB) unless you
   actually need to change OS/device class.

`tabIdentifier` is Xcode-side state: survives agent restarts, dies with
Xcode. Tools enumerate at agent-session start — if Xcode wasn't running
then, the tools are absent until reconnect/restart.

## Division of labor — native tools vs xcode-tools vs CLI

The project type matters: in **SwiftPM packages** (Package.swift),
membership IS the folder layout — native file tools do everything, and the
Xcode file tools add nothing. In **.xcodeproj projects**, membership lives
in the pbxproj — file *lifecycle* must go through Xcode tools or the build
won't see your changes.

| Job | Use | Don't use | Why |
|---|---|---|---|
| Read file contents | native Read | XcodeRead | same bytes without the MCP hop, JSON-escaped payload, or tabIdentifier ceremony |
| Search/list source | native Grep/Glob | XcodeGrep/Glob/LS | faster; content is content |
| Edit existing file | native Edit | XcodeUpdate | Edit errors on ambiguous match; XcodeUpdate silently edits the FIRST occurrence |
| Create file (.xcodeproj) | XcodeWrite | native Write | registers it in project/target; native Write orphans it |
| Delete/rename/move (.xcodeproj) | XcodeRM / XcodeMV | native rm/mv | keeps pbxproj references consistent; RM trashes (recoverable) |
| Any file op (SwiftPM pkg) | native tools | Xcode file tools | folder = membership |
| Group structure / target membership questions | XcodeLS, GetTargetBuildSettings | guessing from disk | groups ≠ folders |
| "What is the user looking at?" | XcodeGetCurrentFile | — | only source of editor focus; `{"isEditable":false}` = nothing focused |
| One-file compile check | XcodeRefreshCodeIssuesInFile | building | no build artifacts touched; sees more than the compiler emits (but ~7–10s — a warm incremental BuildProject can be faster) |
| Full build | BuildProject | shelling to xcodebuild | quiet by design (summary + log file); CLI only for clean builds / flag overrides / CI parity |
| Run tests (.xcodeproj / simulator) | RunSomeTests / RunAllTests | xcodebuild test | structured counts + .xcresult, self-building |
| Run tests (SwiftPM) | `swift test` CLI | MCP test tools | no scheme/simulator needed; CLI is leaner |
| Launch app + debug | RunProject(attachDebugger:true) → InvokeDebuggerCommand | — | the only lldb path; CLI lldb would fight Xcode |
| App stdout/print + OSLog of an Xcode-launched run | GetConsoleOutput | `log show` | print/stdout never reaches unified logging; session-scoped |
| Logs of a process YOU launched via CLI | `log show`/`log stream` | GetConsoleOutput | it only sees Xcode launch sessions |
| Visual check of a SwiftUI view | RenderPreview | building+screenshot rituals | renders #Preview to PNG, ~25–30s, no simulator interaction |
| Try an idea in project context | RunCodeSnippet | scratch files | sees the file's types; stdout-only output |
| Build settings / Info.plist / entitlements | the MCP setting tools | editing pbxproj/plist by hand | validated, reference-safe (entitlements are checked against a real database) |
| String Catalog work | StringCatalog* tools | native Edit of .xcstrings | tools maintain the translation state machine + extraction sync |
| Apple docs lookup | see the `apple-docs` skill's routing section | — | DocumentationSearch is discovery, NOT an existence check |
| iOS UI driving (tap/type/screenshot) | DeviceInteraction* suite | — | requires iOS Simulator 27.0+ runtime; iOS-only — explicitly refuses Mac |

## What only this server gives you

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
5. **`DeviceInteractionSynthesize`** — taps/swipes/typing + screenshot + UI
   hierarchy + app stderr per call, with command chaining (verified live;
   needs an iOS 27+ simulator runtime — iOS only, Mac refused).
6. **Crash/field-performance services** — Apple's field data + triage docs,
   for apps connected in Organizer (pass `bundle_id` explicitly; the
   auto-resolution claim is false in practice).

## Verification ladder (cheapest first — but read the timings)

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

## Failure modes & repair

| Symptom | Cause → fix |
|---|---|
| Server dead at startup: `MCP_XCODE_PID … no running Xcode processes found` | Xcode wasn't running → open Xcode, reconnect/restart session |
| Tools entirely absent | same; enumeration happens once at session start |
| `No workspace windows found` | no project open in Xcode |
| Wrong Xcode answering | set `MCP_XCODE_PID=<pid>` in server env |
| Device tools: `Supported: iOS [Simulator] 27.0+` | install the iOS 27 simulator runtime; Mac is never supported |
| Hard MCP error `{"type":"error","data":…}` vs result with `success:false` | two error envelopes — check both |

Setup (one-time):

```bash
claude mcp add --scope user xcode-tools \
  --env DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
  -- /Applications/Xcode-beta.app/Contents/Developer/usr/bin/mcpbridge
```
