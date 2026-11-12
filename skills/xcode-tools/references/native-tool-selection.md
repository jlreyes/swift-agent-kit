# Choose tools for native Mac development

Choose a tool for the behavior you need to observe. Start with Xcode MCP for
builds and previews, then use a debugger, network proxy, profiler or UI tool
for questions a build or preview cannot answer.

| Question | Start with | Why | Boundary |
|---|---|---|---|
| Does the Mac target compile, and what does its preview render? | Xcode MCP `BuildProject` and `RenderPreview` | Project-aware build results and an actual preview image | A preview is not an interactive app test. |
| What value did this SwiftUI model hold at an action, and which code changed it? | LLDB MCP | Breakpoints, expressions and stepping observe the running process | Choose one debugger owner. A model property is not a general inspector for SwiftUI's private state. |
| Did a click, keyboard action or view transition work? | Cua | It exercises and observes the actual native UI | A field value echoed by accessibility is not proof that a SwiftUI binding changed. Verify the resulting behavior. |
| What request was sent, why did it fail, and what came back? | Proxyman MCP | External HTTP/HTTPS capture exposes headers, payloads and status without adding a network SDK | The client must use the proxy; HTTPS needs client trust and a matching SSL Proxying rule. |
| Where did CPU time go, which SwiftUI updates occurred, or what hang evidence was recorded? | Instruments Analyzer over `xctrace` data | Recorded samples and events can be queried and reconciled with raw exports | Missing frame observations cannot establish FPS or smooth rendering. |
| Can a view-body edit appear without losing the running app's state? | Inject / InjectionIII, when that workflow is wanted | The body-text spike preserved process and app state | Structural changes and added stored properties were not tested. |
| Can a hierarchy inspector replace debugger state reads? | Do not use LookInside as the default | It exposed SwiftUI node and modifier types | Full-tree snapshots crashed; a source-level encoder fix was not validated end to end under Pro. Attributes and gesture records remained unresolved. |

## Choose a workflow, then verify its postcondition

For a functional change, build with Xcode, exercise it with Cua, and use LLDB
when the observed state or control flow is wrong. For a network failure,
inspect the actual request and response through Proxyman before inferring the
problem from UI text. For a performance question, collect the relevant trace
and query the recorded evidence with Instruments Analyzer.

A successful build does not establish that an action changed the model, a
screenshot does not reveal the request body, and a profiler sample does not
prove a frame was dropped.

## Load the procedure that owns the task

- [Native debugging](native-debugging.md): SwiftUI model reads, breakpoints,
  stepping, resume and reconnect.
- [LLDB session ownership](lldb-session-ownership.md): Xcode-owned versus
  standalone sessions.
- [Network inspection](network-inspection.md): capture, scoped body queries,
  HTTPS verification and restoration.
- The `instruments-analyzer` skill: record/export/query workflows and export
  status interpretation.
- The available Cua skill or tool guidance: current target and input APIs.

For a VM or a remote Mac, load the environment's machine-access skill before
choosing the transport or proxy address. Keep personal hostnames, license
placement and credential procedures there.

## What supports these choices

The [November 12 native Mac spike](https://github.com/jlreyes/swift-agent-kit/blob/main/docs/native-mac-tooling-spike-2026-11-12.md)
records the exercised cases, versions and remaining limits. These are dated
observations, not a performance ranking between unlike operations. Before a
new run, inspect the installed tool version, live MCP schema and command help;
update observations when behavior changes.
