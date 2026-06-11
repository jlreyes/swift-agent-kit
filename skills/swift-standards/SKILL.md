---
name: swift-standards
description: >-
  House Swift coding standards, in force for all Swift work — Swift 6 strict
  concurrency, the Observation framework (@Observable/@State), SwiftUI
  performance and invalidation discipline, reactive-over-imperative state,
  SwiftUI preview pitfalls, SwiftData actor-safety, and Apple's agent
  conventions. Load whenever writing, editing, reviewing, or refactoring any
  Swift (.swift) code, SwiftUI view, Swift test, or SwiftPM package — not
  only when debugging or reviewing.
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
