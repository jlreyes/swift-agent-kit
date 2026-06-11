## Problem: Using Old Swift Patterns

**Goal:** Swift 6 strict concurrency + modern Observation. No legacy MVVM wrappers, no implicit thread hops, no callback-first APIs.

### Replace (at a glance)

- `ObservableObject/@Published/@StateObject` → **`@Observable` (+ `@State` in views)**.
- `DispatchQueue` orchestration → **actors** + `await MainActor.run { }`.
- Completion handlers → **async/await** (provide **adapters** where needed).
- Passing live SwiftData models across tasks → **pass `Model.ID` and refetch in the local `ModelContext`**; consider **`@ModelActor`** for background work.

### Rules (non-negotiable)

- **Direct state over ViewModels**: use `@State` in views; create a `Store` (`@Observable`) only for truly shared cross-view state.
- **Pass data down; actions up**: children receive value data + callbacks, not whole stores/VMs. Use `Environment` only for cross-cutting services (e.g., API/logging).
- **UI writes on MainActor; services in actors.** No UI mutation off the main thread.
- **SwiftData**: treat models as **context-bound**; pass identifiers (`Model.ID`) across actors/threads and refetch using that actor’s `ModelContext`. Consider `@ModelActor` to co-locate a `ModelContext` with work.
- **Prefer typed throws** in Swift 6 and use language features (e.g., pack iteration) when they simplify code.
- **Platform features**: prefer iOS 26/macOS 26 APIs where they replace custom code.

### Checklist

- [ ] No `ObservableObject/@Published` unless bridging old code.
- [ ] No completion-handler public APIs; provide async entry points with adapters.
- [ ] No `DispatchQueue` for coordination; use actors/`TaskGroup`.
- [ ] SwiftData: no cross-actor model passing; use IDs + refetch.
- [ ] Views take data + actions, not a VM blob.
- [ ] UI state mutations happen on MainActor.

### Non-obvious, useful snippets

```swift
// Bridge a completion API → async
func fetchUser() async throws -> User {
  try await withCheckedThrowingContinuation { cont in
    client.fetchUser { result in cont.resume(with: result) }
  }
}

// Pass data down, actions up (no VM in child)
struct ItemRow: View {
  let item: Item
  let onDelete: (Item.ID) -> Void
  var body: some View { /* … */ }
}

// SwiftData: pass ID, refetch in local context
struct DetailView: View {
  @Environment(\.modelContext) private var ctx
  let id: Item.ID
  var body: some View {
    if let item = try? ctx
      .fetch(FetchDescriptor<Item>(predicate: #Predicate { $0.id == id }))
      .first {
      Text(item.title)
    }
  }
}
```
