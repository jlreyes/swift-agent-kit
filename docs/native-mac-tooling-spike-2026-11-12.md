# Native Mac tooling spike — November 12, 2026

A small native todo app and controlled workloads exercised tools a coding agent
can use for macOS development, starting with Xcode 27 MCP for builds and
previews. This record describes what happened on November 12, 2026. The
[tool-selection guide](../skills/xcode-tools/references/native-tool-selection.md)
explains which tool to choose for a task.

## Results and recommendation

| Tool | Exercised evidence | Choice and qualification |
|---|---|---|
| Xcode MCP | A real My Mac target built without errors in 20.693 s; a native preview rendered in 3.127 s on Xcode 27.2 (27B52) | Baseline for project builds and previews. The native Xcode MCP debugger command was not exercised in this follow-up. |
| LLDB MCP | Native UI actions stopped at model breakpoints; expressions read the draft and item count; stepping observed a count change; a second client reconnected and completed a toggle | Use for execution and SwiftUI model-state questions. LLDB 2103 and Swift 6.4.2 needed matching symbols/source. A real remote PTY avoided a reproduced pipe/stdio hang. See the [debugger how-to](../skills/xcode-tools/references/native-debugging.md). |
| Cua | Real native pointer/keyboard actions changed app behavior | Use for UI behavior. Accessibility text insertion could echo a value without updating a SwiftUI binding; the resulting behavior needed verification. Protected OS authorization prompts remained user actions. |
| Paid Proxyman MCP | Host-based HTTP and HTTPS capture from three macOS guests; native UI GET 200 loaded 200 todos and POST 201 returned matching JSON; default URLSession POSTs from two other guests returned 200 with matching MCP bodies | Use for external HTTP/HTTPS inspection without adding an app SDK or custom collector. Both direct private-network and existing SSH loopback proxy routes worked. Client OS SSL trust was verified after normal human authorization. |
| Instruments Analyzer | Real native `xctrace` CPU, SwiftUI-update and potential-hang exports reconciled with raw XML after exporter repairs | Use for recorded performance evidence. The fixes were merged upstream and vendored into the kit. Empty raw frame tables establish no FPS or smoothness result. |
| Inject / InjectionIII | A view-body text edit appeared in the same process with unchanged application binary while todos and an unsaved draft remained | A useful body-edit result, not proof of structural edits or added stored properties. Further evaluation remained with the user. |
| LookInside Pro | SwiftUI node/modifier types were visible, but loaded-tree MCP snapshots crashed twice; a verified click changed app state without producing gesture records | Keep out of the default workflow. A small public-host encoder patch reproduced and removed a deep-worker crash, but normal Pro activation stalled in the patched host, preventing full end-to-end validation. Resolved attributes and general gesture capture were not established. |

The durations above are single observations of different operations, not a
comparative latency benchmark. A separate Proxyman activation through unified
Cua took about 128 seconds once; it is an operational observation, not a
general Cua performance claim.

## Network evidence and setup limits

The uninstrumented native client used ordinary `URLSession.shared`. Controlled
HTTP actions covered GET 200, a 503 followed by retry 200, POST 201, and an
offline destination producing a proxy 502 followed by successful recovery.
MCP retrieved the exercised headers/bodies and queried JSON fields.

Explicit `curl --cacert` requests first proved host TLS forwarding with normal
certificate-chain and hostname verification. Later native HTTPS requests succeeded on all three clients using their ordinary
macOS trust stores, without an explicit CA or TLS delegate. These are distinct
proofs. Approved SSL trust was installed in each client user's trust domain;
host trust was not required for remote-client capture.

Proxyman 26.4.0 (build 260400) had several state prerequisites:

- An enabled MCP preference did not always mean the running server had started.
- `get_version` could succeed without an open capture window while traffic
  tools failed. An `open_proxyman` call reported an already-running app without
  creating that missing window.
- A system-proxy acknowledgement did not establish the actual OS proxy state.
- Opening the app enabled host proxying and recording during testing. The
  previous states, filters and temporary SSL rules were restored afterward.

External proxy capture did not preserve original guest app PIDs. Certificate
pinning, proxy-ignoring clients, non-HTTP protocols, replay and response
rewriting were not established by these tests. The
[network how-to](../skills/xcode-tools/references/network-inspection.md) contains
the general procedure; machine routes and credential references belong to the
environment's private machine-access documentation.

## Performance evidence after the repairs

The repaired exporter retained all 27,154 raw CPU samples and 27,062 stacks in
the native SwiftUI capture. Within the advertised recording window, one app
view had 666 update records: 62 View Body records and 604 Other records, not
666 body evaluations. A second capture contained 17 potential-hang rows with
resolved process attribution; those are not 17 distinct proven hangs.

[Instruments Analyzer PR #3](https://github.com/jlreyes/instruments-analyzer/pull/3)
and [kit vendor PR #20](https://github.com/jlreyes/swift-agent-kit/pull/20) were
merged. Both installed copies matched all 20 upstream files, passed 18 tests,
and exported a retained native capture: 4,202 CPU samples, 4,201 stacks and
17 attributed potential-hang rows, with no failed supported-schema exports.
Installed frame preparation correctly returned unavailable for empty frame
observations. Those deployment checks used Xcode 27.2 on one host and 27.0
(27A266a) on the other. No fresh CPU Profiler recording or nonempty frame
recording was part of this validation; recorded CPU Profiler XML fixtures
verified that cycle weights remain distinct from nanoseconds.

## Scope of this record

This spike did not exhaustively assess these tools or evaluate them for iOS.
Check the installed tools and versions before applying its observations to a
different installation. Repeatable procedures live in the skill; this record
preserves the dated evidence.
