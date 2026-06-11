# Problem: Imperative over Reactive

**Goal:** Reactive first; derive, don't duplicate. UI updates flow from state, not manual notifications.

## Smells

- Calling `notify/update/refresh` methods manually.
- Stored fields that are pure derivations of other fields.
- "Service" types that just wrap stateless functions.

## Rules

- Use `@Observable` for shared UI state; `@State` for view‑local state.
- Prefer **computed properties** for derivations (never store duplicates).
- Stateless logic = **free functions** or `static` funcs (no wrapper objects).
- Cache only after profiling proves benefit.

## Checklist

- [ ] No manual NotificationCenter/observers for UI changes.
- [ ] No stored duplicates of derived values.
- [ ] All views have at least one `#Preview`.

## Examples

```swift
// ✅ Derived, not stored
struct Order { let items: [Item] }
extension Order { var total: Double { items.reduce(0) { $0 + $1.price } } }

// ✅ Minimal store for shared state
@Observable
final class CartStore {
  var items: [Item] = []
}

// ❌ Imperative "sync"
final class BadVM {
  var items:[Item] = []
  var total: Double = 0 // stored duplicate
  func add(_ i: Item) { items.append(i); total += i.price /* manual sync */ }
}
```
