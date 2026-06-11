# Problem: Swift Preview Pitfalls

**Goal**: Fast-compiling, working previews.

## Rules

- Wrap ForEach ranges: `ForEach(Array(0..<n), id: \.self)`
- Extract preview data to static properties
- Max 2-3 nesting levels in preview bodies
- Create dedicated preview wrapper views for complex cases

## Tiny Example

```swift
// ❌ ForEach(0..<10) { i in ... }
// ✅ ForEach(Array(0..<10), id: \.self) { i in ... }
```
