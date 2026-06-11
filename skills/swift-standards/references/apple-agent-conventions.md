# Problem: Drifting from Apple's Agent Conventions

**Goal:** Match the conventions Apple steers its own Xcode coding agents with — style, testing, and verification discipline. (Distilled from Xcode 27's agent system prompt; stable since 26.3.)

## Rules

- **Naming**: PascalCase for types; camelCase for properties/methods.
- **SwiftUI state**: `@State private var` for view-local state; `let` for constants.
- **Async**: prefer Swift async/await APIs over Combine; bridge legacy callback APIs with adapters.
- **Types**: lean on the type system; no force unwrapping.
- **Testing**: Swift Testing for unit tests; XCUIAutomation for UI tests.
- **Formatting**: 4-space indentation; imports at top of file.
- **Scope discipline**: limit changes to the requested task — no drive-by edits to unrelated code.
- **Verification ladder**: cheapest check first — per-file live diagnostics → run a small snippet/experiment → full build. Don't reach for a full build to answer a question a snippet can.
- **Post-cutoff APIs**: never assume knowledge of newer Apple APIs; look them up (`apple-docs` / `apple-api-updates` skills, or Xcode's `DocumentationSearch` MCP tool when connected). If a symbol referenced in the project can't be found, treat it as new API and search before concluding it doesn't exist.

## Checklist

- [ ] No Combine where async/await works.
- [ ] No force unwraps.
- [ ] New tests use Swift Testing, not XCTest.
- [ ] Diff touches only what the task required.
- [ ] Unknown or new APIs verified against docs, not guessed.
