---
name: apple-docs
description: >-
  Look up current Apple and Swift documentation for API signatures,
  availability, explanations, examples, HIG guidance, WWDC transcripts,
  Swift Evolution, and framework changelogs. Use for a specific Apple or
  Swift API, including recent APIs: verify symbols in the selected SDK and
  fetch prose from Apple. For iOS/macOS 26 adoption guides use
  apple-api-updates; for SDK-27 SwiftUI use swiftui-whats-new-27; for new
  Document-based SwiftUI apps use building-document-based-swiftui-applications.
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
from the installed Xcode.
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
- No MCP connection → this skill covers everything except semantic discovery
  (substitute: `WebSearch` scoped to developer.apple.com). Xcode 27 can serve
  MCP headlessly, so an open Xcode window is not a prerequisite.

## Recipes

### 1. Exact signature / availability / does a specific API exist → local SDK grep
Apple ships many public Swift declarations in SDK module interfaces — local,
offline, and matched to the selected Xcode. This returns *signatures*, not
prose or examples; use recipe 2 for those.

Search with the **Grep tool** if available, else `rg` via Bash (identical flags):
- pattern: the symbol, e.g. `func glassEffect`
- path: the active Xcode's `Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/System/Library/Frameworks` directory. Obtain its developer directory with `xcode-select -p`, or use the project's explicit `DEVELOPER_DIR`; append the platform path to that directory.
- **Multiple Xcodes installed?** Grep the SDK of the Xcode the project BUILDS with. An SDK mismatch can turn a real recent API into a false zero-hit result.
- glob: `*.swiftinterface`
- **`-B 3`** (Grep tool: `-B: 3`) — the `@available(...)` lines sit *directly above* the declaration, so one pass gets signature **and** availability; don't re-search for `@available`.

Symbols live in their *defining* module (`glassEffect` → **SwiftUICore**, which SwiftUI re-exports),
so grep the whole Frameworks dir. Interfaces ship per-arch, so each decl appears ~twice — ignore
dupes. A zero hit is strong evidence only after checking the selected SDK,
defining module, platform, and the relevant Objective-C headers when the API
is not Swift-imported. **Never `Read` a whole `.swiftinterface` file (they're
1–2 MB), and never hand-write multiline regexes — always plain grep.**

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
- Prefer the `tutorials/data/…json` URL for structured DocC. Some public
  documentation pages also expose a useful `.md` representation; fetch that
  when it is available. Do not rely on the JavaScript HTML shell as the source
  of page content.

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
unavailable: grep `pattern` = your topic in the active Xcode's
`PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation`
directory (derived from `xcode-select -p`), then Read the matching `*.md`.

## Notes
- Prefer **Grep (local SDK)** for candidate signatures and availability, then
  check module/platform/header coverage before treating a zero hit as absence.
  Prefer **WebFetch (DocC JSON or public `.md`)** for understanding — prose,
  examples, and HIG.
- **Can't find it / not sure where it lives?** `WebSearch` scoped to `developer.apple.com` (videos, docs, sample code, and forums are all well-indexed), then WebFetch the best result. This is the general fallback for anything the recipes above don't cover.
- Advanced (only if you need exact structured fields rather than rendered prose): the DocC JSON has `.abstract`, `.primaryContentSections`, `.topicSections`, and a `.references` map (resolve inline `{"type":"reference","identifier":…}` fragments against it). You can `curl <url> | jq` those directly — but WebFetch already does this rendering, so reach for jq only when you need something specific.
- These supplement, not replace, your knowledge — use them on anything recent or when you're unsure.
