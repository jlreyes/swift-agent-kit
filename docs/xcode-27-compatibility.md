# Xcode 27 compatibility

Swift Agent Kit now targets Xcode 27.0 (27A266a). The original kit used
Xcode 27 beta (27A5194q); preserve its empirical observations as dated beta
findings unless the release schema or a repeat probe confirms them.

## Current integration contract

Register the bundled MCP bridge through the active developer directory:

```sh
claude mcp add --scope user xcode-tools -- xcrun mcpbridge
```

The Xcode 27 MCP service can start on demand. Project access may request
approval for the signed agent and directory. In warm headless enumeration,
the service exposed 54 tools and advertised `tools.listChanged`; callers must
read the live tool list and schema rather than depend on a fixed count.

Project tools use optional `workspaceIdentifier`, either a `workspaceN` handle
or absolute workspace path. The release inventory adds
`DeviceInteractionStartWorkspaceSession`, `XcodeCloseWorkspace`,
`XcodeListTargets`, `XcodeListTemplates`, `XcodeListTestPlans`,
`XcodeListWorkspaces`, `XcodeNewProject`, `XcodeNewTarget`,
`XcodeOpenWorkspace`, and `XcodeSwitchTestPlan`. `XcodeListWindows`,
`XcodeGetCurrentFile`, and `XcodeListNavigatorIssues` were absent from the
headless list but are not established as removed UI capabilities.

`StartSession` is workspace-free and cannot build or install. Use
`DeviceInteractionStartWorkspaceSession` for project-backed device work, and
use `interactSessionKey` with `DeviceInteractionSynthesize`. `BuildProject`
accepts `buildForTesting`; synthesis accepts `activationBundleId`.

## Skills and documentation parity

`xcrun agent skills export` supplies ten skills. Xcode's native Codex and
Claude plug-ins supply 15: the ten exports plus translation, translation
coordination, and three accessibility specialists. Swift Agent Kit retains
the `ios-dynamic-text` implementation entry alongside the official Dynamic
Type audit specialist, and retains old `c-bounds-safety` and
`test-modernizer` names as aliases for their released canonical names,
`adopt-c-bounds-safety` and `modernize-tests`.

The installer is the only route that materializes Apple-authored bodies. It
must preserve this kit's concise trigger descriptions, namespace adaptations,
and integration notes while leaving Apple source out of Git. The Xcode 27 App
Intents descriptions exceed the 1,024-character description limit used by
some harnesses, so the kit maintains shorter frontmatter descriptions with
full routing after extraction.

All 20 `AdditionalDocumentation` guides from the prior local extraction match
the installed Xcode 27.0 copies byte-for-byte. They are materialized locally,
not committed to this repository. They remain the SDK 26 adoption layer;
version-specific SwiftUI, App Intents, document-app, and accessibility work
routes to its matching Xcode skill.

## Verification performed

The installer fixture suite passes 18 tests:

```sh
python3 -m unittest discover -s tests -v
```

With Xcode 27 installed, the opt-in local parity check can run both the plugin
and flat layouts in temporary directories:

```sh
python3 tests/verify_local_xcode.py
```

It does not overwrite the repository. It checks the official file inventory,
portable namespace adaptation, API-guide bytes, idempotence, and the complete
marker; it does not prove a real project or device workflow.

The release investigation also recorded a headless MCP initialize and warm
tool list, native skill/plugin inspection, and command-help checks. The LLDB
MCP server completed a target-free start/get/stop and schema probe; no app was
launched or attached. `devicectl` command help exposed screenshots, recording,
orientation, pasteboard, simulation, and process controls; no device behavior
was exercised. Xcode's UI stayed open during the MCP probe, so this audit did
not independently prove a UI-closed workflow.

Before changing this integration for a later Xcode release, rerun the skill
materialization and MCP inventory checks. Treat any changed schema or skill
layout as the authority, then update this document and the `xcode-tools`
guide together.
