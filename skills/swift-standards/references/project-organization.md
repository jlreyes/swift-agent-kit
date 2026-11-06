# Project organization

Organize code so a developer can find a feature, identify who owns its state,
and follow an action to its effect. Preserve a repository's working conventions;
use these defaults for new code or an explicitly requested reorganization.
They do not authorize a broad refactor during an unrelated change.

## Start with a feature, not a file template

Keep a screen's views, small state types, and actions together. A simple feature
may need only a view; a complex conversation flow may need a composer, a detail
view, and an observable model. Add files when their names explain a distinct
responsibility. Do not require `Models`, `Views`, `ViewModel`, `Actions`, and
`Coordinator` files for every feature.

Use product names such as `Conversations`, `Library`, and `Access`. A folder
called `Agents` is ambiguous if it contains both agent runtime integration and
the owner's conversation screens. Avoid broad `Core`, `Managers`, or `Shared`
folders unless their contents have an identifiable owner and purpose.

One possible small app layout is:

```text
App/                         dependency composition, windows, navigation
Features/
  Conversations/
    ConversationView.swift
    ComposerView.swift
  Library/
  Access/
Data/
  ComputerStore.swift
  ComputerClient.swift
Platform/                    integrations that differ between targets
```

Create only the populated parts needed now. These are folders, not a required
set of SwiftPM targets. Split an operation or screen before a file becomes a
miscellaneous collection; don't split every small helper by default.

## State ownership determines the architecture

Keep canonical product data in its shared owner, such as an observable store or
the application's existing persistence/query layer. Screens can read that
data directly; copying it into a view model adds a second synchronization job.
Pass focused data and actions into child views rather than the entire store.

Keep a draft, sheet selection, and navigation path at the screen, window, or
flow that owns them. Keep an account connection and subscriptions at their
account/session boundary. A second window should be able to select a different
conversation without opening another account connection or sharing its draft.

Use local SwiftUI state for simple interactions. Introduce an `@Observable`
feature model when it owns substantial behavior, such as pagination,
streaming, cancellation, or a multi-step workflow. Naming it a model does not
justify duplicating product data. Follow `imperative-patterns.md` and
`swiftui-performance.md` for derivation and observation details.

Product types and presentation state have different owners: a `Message` can be
shared, while composer validation belongs beside the composer. Introduce
separate API or persistence representations when their shape or lifecycle
differs; don't create identical DTO/domain/view structs solely to fill layers.

## Share mechanisms; keep action meaning local

Where optimistic UI is needed, share the lifecycle of pending mutations:
identity, ordering, delivery, outcomes, and reconciliation. Keep an action's
server request and temporary local effect together, rather than distributing
each across an intents file, an optimism file, and a central projection switch.
An intent here is a requested command; an event describes a completed change.

For a simple pending-update model, display the latest confirmed state with
outstanding local changes applied in order. Capture identifiers and timestamps
once when queuing a change, so replaying its temporary effect is deterministic.
Remove the matching pending change
when its outcome is known. Reconcile against current confirmed state rather
than restoring a stale whole-state snapshot after a failure. Preserve existing
conflict rules; this model is not an offline persistence or replication engine.

The temporary effect still needs feature meaning: sending a message may append
a pending row, while an access decision may show a pending status. A shared
helper cannot infer those semantics. An optimistic approval must not be treated
as an authoritative grant or release receipt. These are design recommendations
from implementation review, not claims about the repositories below.

## Separate real dependency and runtime boundaries

Compose dependencies at the app/session boundary and pass the capabilities a
feature needs. Keep live configuration loading and connection creation out of
otherwise presentational screens, so previews can use sample state and actions
without starting network or execution services. This does not require a
protocol, factory, or dependency container for every type.

Keep macOS/iOS integrations outside shared product behavior when their
dependencies differ. Introduce a package or target for meaningful reuse,
platform exclusion, or a build boundary. A folder is enough for navigation
within one target. Extract shared UI after actual reuse appears.

## Evidence and limits

Representative source files rechecked on 2026-11-06. Links pin the inspected
commits. The recommendations above are a synthesis, not a claim that these
projects use one architecture or that their historical mechanisms are modern
Swift defaults.

| Source inspected | Observation | Lesson and limit |
| --- | --- | --- |
| Element X [login state](https://github.com/element-hq/element-x-ios/blob/e8ddd6ad2a70ddd2e3b87125adba0f8e31025af5/ElementX/Sources/Screens/Authentication/LoginScreen/LoginScreenModels.swift) and [view model](https://github.com/element-hq/element-x-ios/blob/e8ddd6ad2a70ddd2e3b87125adba0f8e31025af5/ElementX/Sources/Screens/Authentication/LoginScreen/LoginScreenViewModel.swift) | Screen-local models describe bindings and presentation state; the view model receives authentication dependencies. | Borrow screen co-location and dependency ownership. Its action/store/protocol structure and Combine use are not a required starter pattern. |
| Ice Cubes [timeline view](https://github.com/Dimillian/IceCubesApp/blob/98098b9c4b5928f89f338203193c2bf40ab7f38c/Packages/Timeline/Sources/Timeline/View/TimelineView.swift) and [timeline model](https://github.com/Dimillian/IceCubesApp/blob/98098b9c4b5928f89f338203193c2bf40ab7f38c/Packages/Timeline/Sources/Timeline/View/TimelineViewModel.swift) | The view receives environment dependencies and owns an observable timeline model with fetching and streaming behavior. | A complex feature can warrant a model. This does not imply every screen needs one, nor that all of its dependency patterns should be copied. |
| Sill [package manifest](https://github.com/Saffsanity/sill/blob/41e8cb8801f8e9d387e27a0d498dee193d17e9ec/Package.swift) and [menu-bar app model](https://github.com/Saffsanity/sill/blob/41e8cb8801f8e9d387e27a0d498dee193d17e9ec/Sources/SillMenuBar/AppModel.swift) | Protocol types, Mac host implementation, CLI, and menu-bar executable have explicit target dependencies; an observable app model coordinates the host. | Runtime and platform boundaries can justify modules. This does not establish that its entire app model fits a larger product. |

Before settling a layout, trace one meaningful action from view through state
and dependencies to its result. Each boundary should explain ownership,
independent behavior, or a real dependency. If it only forwards unchanged
arguments, consider keeping that code together.
