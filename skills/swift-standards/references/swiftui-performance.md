# Problem: SwiftUI Performance Pitfalls

**Goal:** Fast, smooth UI. Minimize invalidation blast radius; don't build perpetual motion machines in AttributeGraph.

## Smells

- Janky scrolling or animations
- Laggy UI on data changes
- Visible layout pops/jumps

## Rules

**Invalidation scope:**

- **State low in tree**: `@State` change re-evaluates that view + subtree. Store where needed, not at root.
- **Narrow observation**: Reading N fields from `@Observable` = N invalidation triggers. Split models or use focused computed props.
- **Avoid environment churn**: Frequently-changing `.environment()` values invalidate big subtrees. Prefer tight bindings.
- **Equatable gates**: Expensive subtrees should only depend on fields they display; equate on those.

**Identity & diffing:**

- **Stable IDs**: Avoid `id: \.self` for mutables, `ForEach(indices)` for reorderable data, `.id(UUID())` as a "fix".
- **Use `.id()` for state scoping**: Resets `@State` when data changes—avoids `onChange` hacks.
- **No `AnyView`**: Forces less efficient diffing; defeats structural optimizations.

**View body discipline:**

- **ForEach → one view**: Multiple children force slow-path diffing. Wrap in `Group`/`VStack`.
- **No O(n) in body**: Filter/sort/search in data layer, not inline.
- **No blocking calls**: File I/O, network, heavy compute → async (`.task`, actors).
- **No per-row `onAppear` side effects**: Fires constantly during scroll. Use `.task(id:)` with dedupe/cancel.

**Layout & rendering:**

- **Avoid GeometryReader**: Two layout passes. Guard measurements—only update state when value meaningfully changes.
- **No nested ScrollViews / LazyVStacks**: Breaks gestures, causes jumping. One lazy container at top; regular stacks inside.
- **Effects cost GPU**: `blur`, `shadow`, masks in scroll containers → overdraw. Use sparingly in rows.

**High-frequency inputs:**

- **Debounce**: Keystrokes, sliders, scroll position can fire dozens/sec. Debounce before filtering or model writes.

## Checklist

- [ ] State stored as low as practical.
- [ ] Observable models split so high-churn fields don't invalidate the world.
- [ ] `ForEach` uses stable IDs (not indices, not `\.self` for mutable refs).
- [ ] ForEach content is a single view.
- [ ] No `filter`/`sort`/`reduce` inside `body`.
- [ ] No synchronous I/O in `body`.
- [ ] No `AnyView` unless truly required.
- [ ] Expensive subtrees are Equatable-gated or split into smaller views.
- [ ] No preference/geometry loop without change-threshold guard.
- [ ] No per-row `onAppear` work without dedupe/cancel.
- [ ] One lazy container per scroll hierarchy.

## Patterns

```swift
// Debounce with .task(id:) — auto-cancels on new value
@State private var query = ""
var body: some View {
  SearchField(text: $query)
    .task(id: query) {
      try? await Task.sleep(for: .milliseconds(250))
      await model.setQuery(query)
    }
}
```

```swift
// Guard measurement updates
.onPreferenceChange(HeightKey.self) { new in
  guard abs(new - height) > 0.5 else { return }
  height = new
}
```

```swift
// ID-scoped state (not onChange)
DetailEditor(item: selectedItem)
  .id(selectedItem?.id)
```

```swift
// Nested stacks: one lazy, rest regular
ScrollView {
  LazyVStack {
    ForEach(sections) { section in
      VStack { ForEach(section.items) { ... } }
    }
  }
}
```
