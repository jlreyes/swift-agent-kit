# swift-agent-kit

**Claude Code as your Swift editor. Xcode as the attached worker.**

This plugin exists to make one workflow actually good: you write Swift in
an agentic CLI (Claude Code today; the pieces are portable to Codex/Cursor),
and Xcode stays open purely as a service — build system, simulator,
debugger, doc index, device driver — reached over its bundled MCP server.
Nobody is editing in Xcode.

That workflow has real gaps today. Each layer of this kit closes one:

| Gap | What closes it |
|---|---|
| Agents write stale Swift — old patterns (ObservableObject, DispatchQueue, XCTest), pre-cutoff APIs, wrong concurrency | **`swift-standards`** — house doctrine, in force for all Swift work: Swift 6 strict concurrency, Observation, SwiftUI invalidation discipline, reactive-over-imperative, Apple's own agent conventions |
| Agents hallucinate APIs and can't tell "new API" from "doesn't exist" | **`apple-docs`** — lookup recipes with a falsification path: local SDK `.swiftinterface` grep (0 hits = doesn't exist; semantic search can never tell you that), DocC JSON for prose/examples/HIG, WWDC transcripts, Swift Evolution — plus empirically-derived routing rules for when Xcode's `DocumentationSearch` beats each of them |
| Agents post-date the current SDK generation | **`apple-api-updates`** (Apple's iOS/macOS-26-era adoption guides, extracted locally) + **`swiftui-whats-new-27`** and Apple's other Xcode 27 skills (extracted locally) |
| Agents drive Xcode's MCP server badly — wrong tool for the job, 26KB dumps in context, missed state gates | **`xcode-tools`** — an operating guide built from ~190 live probe calls: division-of-labor table (native tools vs xcode-tools vs CLI, the `.xcodeproj` membership rule, the SwiftPM exception), measured timings, noise table, per-tool verdicts and failure modes |
| Apple's skills are excellent but not redistributable | **Stub + extract + hook**: this repo ships zero Apple content; an install script extracts the real skills from *your* Xcode (see below) |

## Install

```
/plugin marketplace add jlreyes/swift-agent-kit
/plugin install swift-agent-kit@swift-agent-kit
```

Then extract Apple's skills from your local Xcode (requires Xcode 27+,
license accepted, ~5 seconds):

```bash
"$(claude plugin dir swift-agent-kit 2>/dev/null || echo ~/.claude/plugins/cache/swift-agent-kit/swift-agent-kit)"/scripts/extract-apple-skills.sh
```

Easier: just start a session — a SessionStart hook notices the missing
content and prints the exact command (and any agent that triggers a stub
skill is instructed to run it, then re-invoke; extracted bodies are picked
up immediately, no restart). The notice disappears once extraction has run.

Wire up the Xcode MCP server (one-time; Xcode must be running when a
session starts for its tools to enumerate):

```bash
claude mcp add --scope user xcode-tools \
  --env DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
  -- /Applications/Xcode-beta.app/Contents/Developer/usr/bin/mcpbridge
```

## How the extraction works (and why)

Apple ships ten agent skills inside Xcode 27 and provides a supported
export command (`xcrun agent skills export`) — but the Xcode license grants
internal use only and expressly reserves redistribution. So this repo ships
**stubs**: real frontmatter (our own words, so triggering works from the
first session) with a body that says "not extracted yet." The script:

1. runs Apple's own export for the seven globally available skills,
2. copies the two localization skills from Xcode's frameworks (adding our
   frontmatter — Apple ships them without one),
3. carves `ios-dynamic-text` from the binary that embeds it,
4. copies Apple's 20 API-update guides into `apple-api-updates/references/`,
5. stamps `.apple-content-extracted` with your Xcode build.

Everything lands in your installed copy only; `.gitignore` and the LICENSE
make clear extracted content is Apple's and must not be committed back.

**Plugin updates** install a fresh copy without the extracted content — the
hook notices and asks you to re-run (the script is idempotent). Same after
upgrading Xcode: re-run to pick up Apple's latest skill revisions.

## Recommended companion setup

Skill auto-loading has an empirically measured blind spot: models route
reliably to skills for lookup-shaped questions, but often answer
familiar-looking tasks (inline review, test writing, recognizable compile
errors) from memory without consulting anything — including the case where
that's most dangerous (`@State` compile errors after an SDK update, where
the "obvious" fix is documentedly wrong). Push-layer mitigation — add to
`~/.claude/CLAUDE.md`:

> For any Swift work, load `swift-agent-kit:swift-standards` first. For any
> `@State` compile error after an SDK update, consult
> `swift-agent-kit:swiftui-whats-new-27` before proposing a fix.

And allow the Swift toolchain in `~/.claude/settings.json` permissions:
`Bash(swift:*)`, `Bash(xcodebuild:*)`, `Bash(xcrun:*)`, `Bash(xcodegen:*)`.

## What's inside

- `skills/swift-standards/` — doctrine + per-topic references (ours, MIT)
- `skills/apple-docs/` — doc-lookup recipes + DocumentationSearch routing (ours, MIT)
- `skills/xcode-tools/` — MCP-server operating guide + per-tool reference (ours, MIT)
- `skills/apple-api-updates/` — routing wrapper (ours, MIT); references extracted
- `skills/<ten Apple skills>/` — stubs (ours, MIT) until extracted
- `scripts/extract-apple-skills.sh`, `scripts/check-apple-content.sh`, `hooks/hooks.json`

## Licensing

Original content is MIT. Apple-authored content is **never** in this
repository or its history; the extraction script places it on your machine
under your own Xcode license (internal use). Don't commit extracted content
back; PRs containing Apple-authored skill bodies will be closed.

## Status

Built against Xcode 27.0 beta (27A5194q). The xcode-tools guide and the
routing rules are empirical — derived from live probing and headless
routing tests — and will drift as Xcode betas rev; re-extraction and issue
reports welcome.
