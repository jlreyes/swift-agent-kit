## Problem: Concurrency Pitfalls

**Goal:** Strict swift 6 concurrency; no thread blocking; minimize opportunites for race conditions.

### Rules

- **UI = MainActor.** All UI state writes go through `await MainActor.run { }` or `@MainActor` types.
- **Stateful services = actors.** No shared mutable state outside actors.
- **No `Task.detached`** without a documented reason; prefer `Task {}` to inherit cancellation/priority.
- **Cancellation first-class**: check `Task.isCancelled` in loops/streams.
- **Timeouts & retries**: add explicit policies (use project RetryOperators where applicable).
- **SwiftData**: pass IDs across actors; refetch in each actor’s `ModelContext`; consider `@ModelActor` for background ops.
- **Minimize Mutability**: Sendable, structs > classes. Pure functions. Actors > Mutex/Semaphores.
