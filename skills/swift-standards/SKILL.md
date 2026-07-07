---
name: swift-standards
description: >-
  House Swift coding standards — Swift 6 strict concurrency, the Observation
  framework (@Observable/@State), SwiftUI performance,
  reactive-over-imperative state, SwiftUI preview pitfalls, SwiftData
  actor-safety, and Apple's agent conventions. WHEN TO LOAD: before writing
  or editing ANY Swift code — including small edits, additions, and
  extensions to existing files. Load the skill and read its reference
  material first, then keep applying it while you write. WHY THIS IS
  NON-NEGOTIABLE: this skill defines what NEW code must look like; it is not
  optional background you merely read. Loading it is necessary but NOT
  sufficient — the point is to APPLY it. Existing code in this repo may
  predate the standards. The code you ADD or CHANGE must conform to the
  standards even when it sits inside a legacy file that does not. Never
  mirror or copy the patterns of surrounding code just because they are
  there — matching a legacy file's style is not a goal; conforming to the
  standard is. If a task says new code should "behave like" an existing
  feature, that means match the observable BEHAVIOR (what persists, what the
  rest of the app sees), NOT the legacy implementation. TRANSLATE LEGACY →
  MODERN whenever you touch it. These deprecated patterns must NOT appear in
  code you add, and here is what to write instead: - ObservableObject +
  @Published stored properties → an @Observable class (Observation
  framework) with plain stored properties. No `@Published`, no
  `ObservableObject`. - Broadcasting state changes with
  `NotificationCenter.default.post` (and matching observers) → make the
  state reactive: hold it in an @Observable type and let the rest of the app
  read the property directly so views/consumers react automatically. No
  manual posts, no custom Notification.Name, no observer registration. -
  Hand-rolled `Binding(get:set:)` wrappers → use `@Bindable` and the `$`
  projection for two-way binding (e.g. `Toggle("Show Previews", isOn:
  $settings.showPreviews)`). - Scattered `UserDefaults.standard`
  reads/writes in initializers and setters → persist through `@AppStorage`
  or the skill's centralized/reactive persistence pattern, not raw
  `UserDefaults.standard.bool(forKey:)` / `.set(_:forKey:)` calls sprinkled
  through the store. - DispatchQueue / completion handlers → async/await,
  with `@MainActor` isolation where UI state is involved. MIGRATE WHEN
  SMALL: if the surrounding legacy is small and self-contained, bring it up
  to standard while you are there rather than layering more legacy on top.
  If a full migration would be too large or risky, still write your NEW
  addition to the standard and keep it internally consistent — do NOT
  regress to `@Published` / `NotificationCenter` posts / hand-rolled
  `Binding` / raw `UserDefaults` in order to "match" the file. BEFORE
  FINISHING: re-read the diff of what you added and confirm it contains none
  of the deprecated patterns above. If any slipped in from mirroring
  neighbors, rewrite them to the modern equivalent before you report the
  change as done.
metadata:
  author: jlreyes
---

# Swift Coding Standards

Authoritative for Swift work. The non-negotiables are inline below; each
area has a reference with the full rules, rationale, and patterns — read the
relevant reference before working in that area, and when reviewing code
against it.

## Non-negotiables (always apply)

**Modern Swift** — `@Observable` (+ `@State` in views), never
`ObservableObject/@Published/@StateObject` except when bridging old code.
Actors + `await MainActor.run {}` over `DispatchQueue`. async/await over
completion handlers and Combine (adapters for legacy APIs). Views take data
+ action callbacks, not ViewModel blobs. Typed throws where they help.
SDK 27: `@State` is now a macro — for any post-SDK-update compile error in a
view using `@State` ("used before being initialized", "invalid redeclaration
of synthesized property", "extraneous argument label"), consult the
`swiftui-whats-new-27` skill before fixing; the obvious fix (reordering init
assignments) is wrong.

**Concurrency** — UI writes on MainActor only. Stateful services are actors;
no shared mutable state outside them. No `Task.detached` without a
documented reason. Check `Task.isCancelled` in loops/streams. SwiftData:
pass `Model.ID` across actors and refetch in the local `ModelContext`
(consider `@ModelActor`); never pass live models.

**Reactive over imperative** — derive, don't duplicate: computed properties
for derivations, no stored copies, no manual notify/refresh calls. Stateless
logic = free/static functions, not wrapper objects. Cache only after
profiling.

**SwiftUI performance** — state as low in the tree as practical; split
`@Observable` models so high-churn fields don't invalidate the world; stable
ForEach IDs (never indices or `\.self` on mutables); no `filter`/`sort` or
blocking work in `body`; no `AnyView` without need; one lazy container per
scroll hierarchy; Equatable-gate expensive subtrees; debounce
high-frequency inputs.

**Apple agent conventions** — PascalCase types / camelCase members;
`@State private var`; no force unwraps; Swift Testing for unit tests,
XCUIAutomation for UI tests; 4-space indent; limit changes to the requested
task; verify cheapest-first (per-file diagnostics → snippet → build); never
guess at post-cutoff APIs — look them up (`apple-docs`,
`apple-api-updates`, or Xcode's DocumentationSearch per its routing rules).

## References

- `references/old-swift-patterns.md` — the replace-at-a-glance table for
  legacy patterns (ObservableObject, DispatchQueue, completion handlers,
  SwiftData model passing), with adapters and snippets. Read when
  modernizing or reviewing older code.
- `references/concurrency.md` — the strict-concurrency rule set (MainActor,
  actors, cancellation, timeouts, Sendable). Read when writing or reviewing
  concurrent code.
- `references/imperative-patterns.md` — reactive-first rules, smells, and
  examples (derived-not-stored, minimal stores). Read when you see manual
  sync/notify patterns or stored derivations.
- `references/swiftui-performance.md` — full invalidation/identity/layout
  rules with checklist and patterns (debounce via `.task(id:)`, guarded
  measurements, `.id()` state scoping, lazy-container layout). Read before
  performance work or SwiftUI review; for deeper dives the vendored
  `swiftui-specialist` skill goes further.
- `references/preview-pitfalls.md` — fast-compiling, working previews. Read
  when writing `#Preview` blocks.
- `references/apple-agent-conventions.md` — the conventions Apple steers its
  Xcode agents with, including the verification ladder. Read when unsure
  about style or testing-framework choices.
