---
name: apple-docs
description: >-
  Looks up real, current Apple/Swift documentation to supplement model
  knowledge — SwiftUI/UIKit/Foundation API signatures and availability, full
  API-reference prose and code examples, the Human Interface Guidelines, WWDC
  session transcripts, Swift Evolution proposals, and Apple's curated
  per-framework what's-new changelogs for any OS release. Use for ANY
  question about a specific Apple or Swift API or symbol — explaining how it
  works, showing code examples, confirming it exists, getting its exact
  signature and availability, or checking recent APIs that may post-date
  training data. Use it even while working inside a Swift project: questions
  about an Apple API are answered from Apple's docs, not the repo. For
  iOS/macOS 26 adoption guides (Liquid Glass etc.) see apple-api-updates;
  for SDK-27 SwiftUI changes see swiftui-whats-new-27. Uses only built-in
  tools (Grep against the local Xcode SDK; WebSearch + WebFetch against
  Apple's DocC JSON, the HIG, WWDC videos, and Swift Evolution).
---

# Apple & Swift Documentation Lookup

Your training data covers older Apple APIs well but is often stale or missing for recent
releases (iOS/macOS 26, Liquid Glass, the newest SwiftUI). Fetch **ground truth** with the
built-in tools below — no scripts, nothing to install.

**Load the tools you need up front.** This skill uses `WebFetch`, `WebSearch`, and `Grep`. Any that
are deferred, load via ToolSearch first (e.g. `select:WebFetch,WebSearch`). If the `Grep` *tool*
isn't available this session, use `rg` (or `grep -r`) via Bash with the same flags.

**Route by what's being asked — this matters:**
- *Explain / how does it work / show examples / read the docs or HIG* → **WebFetch the DocC JSON** (recipe 2): it has Apple's official prose **and code examples**. Do NOT local-grep for this (interfaces have signatures, not examples), and do NOT grep the user's own project for Apple's docs.
- *Exact signature / availability / does a specific API exist / since-which-version* → **local SDK grep** (recipe 1).
- *What's NEW in a framework (any release)* → **WebFetch the curated Updates changelog** (recipe 2; grouped by year — June 2025 = iOS/macOS 26) — don't brute-force grep the SDK. For SDK-27 SwiftUI specifically, the `swiftui-whats-new-27` skill's references are richer; for 26-era adoption guides, `apple-api-updates`.
- *Find a WWDC video* → recipe 3.  *Why a Swift feature exists* → recipe 4.

**If the `xcode-tools` MCP server is connected** (tools named
`mcp__xcode-tools__*` exist), its `DocumentationSearch` adds one capability
this skill lacks: **semantic discovery** — "what's the API for X" when you
don't know the symbol name — over API reference, HIG, AND tutorials, indexed
from the installed Xcode (so it matches the beta SDK you compile against).
Division of labor, verified empirically:
- *Don't know the name / conceptual / HIG* → `DocumentationSearch`
  (use its `frameworks` filter; ~30KB/query).
- *Know the symbol, want prose/examples* → still WebFetch DocC (recipe 2):
  direct hit, no Xcode needed, no 20-result noise.
- *Existence / signature / availability* → still SDK grep (recipe 1).
  **Never use DocumentationSearch as an existence check**: semantic search
  always returns ~20 confident-looking results — a fabricated API name
  scored 0.52–0.56 vs a real query's 0.57, and it has no "not found". Grep
  returns 0 hits for fakes; that falsification is the point.
- Exact-symbol queries in DocumentationSearch rank *related* pages above the
  symbol's own page, then degrade to noise below ~0.6 score — treat the tail
  as filler.
- No Xcode running / no MCP → this skill covers everything except semantic
  discovery (substitute: `WebSearch` scoped to developer.apple.com).

## Recipes

### 1. Exact signature / availability / does a specific API exist → local SDK grep
Apple ships every public declaration in the SDK's Swift module interfaces — local, offline, an
exact match for the Xcode you compile against. (This returns *signatures*, not prose or examples —
for those use recipe 2.)

Search with the **Grep tool** if available, else `rg` via Bash (identical flags):
- pattern: the symbol, e.g. `func glassEffect`
- path: `/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/System/Library/Frameworks` (a stable symlink to the active SDK — grep it directly, no `xcrun` needed)
- **Multiple Xcodes installed?** Grep the SDK of the Xcode the project BUILDS with — for beta-SDK work substitute `Xcode-beta.app` in the path, or availability answers will be a major version stale (e.g. an iOS 27 API shows zero hits in 26.x's SDK, which reads as "doesn't exist").
- glob: `*.swiftinterface`
- **`-B 3`** (Grep tool: `-B: 3`) — the `@available(...)` lines sit *directly above* the declaration, so one pass gets signature **and** availability; don't re-search for `@available`.

Symbols live in their *defining* module (`glassEffect` → **SwiftUICore**, which SwiftUI re-exports),
so grep the whole Frameworks dir. Interfaces ship per-arch, so each decl appears ~twice — ignore
dupes. **Never `Read` a whole `.swiftinterface` file (they're 1–2 MB), and never hand-write
multiline regexes — always plain grep.**

**Is a *specific* API new in 26 / since when?** Grep its name with `-B 3` (above) — the `@available`
line answers it. For a *full list* of what's new in a framework, **don't grep the SDK** — use the
curated changelog (recipe 2, the `Updates/<Framework>.json` page).

### 2. Explain / examples / full API reference / HIG → WebFetch (Apple DocC JSON)
This is the route for any *"explain X" / "how does X work" / "show me examples" / "what do the
HIG say"* request — the DocC JSON carries Apple's official prose **and code examples** (the local
SDK interfaces have neither). Apple renders every doc page from DocC JSON: a stable, versioned
endpoint. **WebFetch the JSON URL** and ask for Markdown — it resolves cross-references, code
samples, and tables for you. Fetch each URL **once** (ask for everything you need in the prompt).
- **API reference:** `https://developer.apple.com/tutorials/data/documentation/<path>.json`
  e.g. `…/documentation/swiftui/view/scrolltargetbehavior(_:).json` (lowercase the path)
- **Human Interface Guidelines:** `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<topic>.json` — e.g. `…/materials.json` (note the `design/…` slug — no `documentation/` segment for HIG). Topic slugs aren't always 1:1: **Liquid Glass guidance lives on `materials.json`**, not `liquid-glass.json`. If a guessed slug 404s, `WebSearch developer.apple.com/design` to find the right page instead of guessing again.
- **Framework index / "what APIs are in X":** `…/tutorials/data/documentation/<framework>.json` — its `topicSections` list the members.
- **What's NEW in a framework** (best for "what changed in iOS/macOS 26"): `https://developer.apple.com/tutorials/data/documentation/Updates/<Framework>.json` — e.g. `Updates/SwiftUI.json`. Apple's curated "what's new," grouped by release; the **June-2025** section = iOS/macOS 26. One WebFetch beats grepping thousands of `@available` lines.
- Do NOT WebFetch `developer.apple.com/documentation/…` (the human page) — it's a JS shell with no content. Always use the `tutorials/data/…json` URL.

### 3. WWDC sessions — find by topic, then read → WebSearch + WebFetch
- **Find sessions:** `WebSearch "WWDC <topic>"` (optionally `allowed_domains: ["developer.apple.com"]`). Apple's session pages are well-indexed, so this reliably surfaces the relevant sessions across *all* years (2015→latest). E.g. "WWDC SwiftUI scroll performance" → *Demystify SwiftUI performance* (wwdc2023/10160) and *Optimize SwiftUI performance with Instruments* (wwdc2025/306); "WWDC Instruments time profiler" → the 2016 *Time Profiler* / *System Trace in Depth* sessions and the 2025 CPU/Processor-Trace ones. Results include the `…/videos/play/wwdc<year>/<id>/` URL.
- **Read a session:** `WebFetch https://developer.apple.com/videos/play/wwdc<year>/<id>/` → the full transcript (no timestamps).
- Apple also has topic-browse pages such as `…/videos/developer-tools/performance` that you can WebFetch to list a category's videos.

### 4. Swift Evolution — the "why" behind a language feature → WebFetch
- A specific proposal: `WebFetch https://raw.githubusercontent.com/swiftlang/swift-evolution/main/proposals/<NNNN>-<slug>.md`
- Search by keyword: `WebFetch https://download.swift.org/swift-evolution/v1/evolution.json` (has `.proposals[]` with `id`/`title`/`summary`/`status`) and filter for your term.

### 5. iOS 26 design/adoption guides (Liquid Glass, AlarmKit, FoundationModels…) → apple-api-updates skill
These Apple adoption guides are vendored in this plugin's `apple-api-updates`
skill (references indexed by topic) — use that skill directly. Fallback if it's
unavailable: grep `pattern` = your topic, `path` =
`/Applications/Xcode.app/Contents/PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation` (substitute `Xcode-beta.app` for the beta), then Read the matching `*.md`.

## Notes
- Prefer **Grep (local SDK)** for "exists / signature / since-when" — instant, offline, exact. Prefer **WebFetch (DocC JSON)** for understanding — prose, examples, HIG.
- **Can't find it / not sure where it lives?** `WebSearch` scoped to `developer.apple.com` (videos, docs, sample code, and forums are all well-indexed), then WebFetch the best result. This is the general fallback for anything the recipes above don't cover.
- Advanced (only if you need exact structured fields rather than rendered prose): the DocC JSON has `.abstract`, `.primaryContentSections`, `.topicSections`, and a `.references` map (resolve inline `{"type":"reference","identifier":…}` fragments against it). You can `curl <url> | jq` those directly — but WebFetch already does this rendering, so reach for jq only when you need something specific.
- These supplement, not replace, your knowledge — use them on anything recent or when you're unsure.
