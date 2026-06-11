# swift-agent-kit

Skills, lessons, and pitfalls from a year of building a complex Swift app
with an agentic CLI as the primary editor and Xcode as an attached worker.
Agents are bad at Swift in specific, fixable ways — they write last year's
patterns, can't tell a new API from a hallucinated one, and drive Xcode's
MCP tools badly — and Apple's own fixes (the agent skills bundled in
Xcode 27) aren't redistributable. This plugin bundles the fixes: house
doctrine, ground-truth doc lookup, an empirical operating guide for
Xcode's MCP server, and Apple's skills extracted locally from *your*
Xcode.

## What it does

1. **Enforces Swift doctrine** (`swift-standards`) — the rules that survive
   contact with a real codebase: Swift 6 strict concurrency, Observation,
   SwiftUI invalidation discipline, reactive-over-imperative state,
   preview pitfalls, SwiftData actor-safety, Apple's agent conventions.
2. **Grounds every API claim** (`apple-docs`) — recipes with a
   falsification path: grep the local SDK interfaces (0 hits = the API
   doesn't exist — semantic search can never tell you that), DocC JSON for
   prose and examples, the HIG, WWDC transcripts, Swift Evolution, plus
   measured routing rules for when Xcode's `DocumentationSearch` beats
   each.
3. **Operates Xcode as a service** (`xcode-tools`) — division of labor
   between native tools, Xcode's 47 MCP tools, and the CLI, from ~190
   live probe calls: the `.xcodeproj` membership rule, measured timings,
   output-noise control, debugger/device/preview workflows, failure modes.
4. **Ships Apple's knowledge without shipping Apple's content** — the ten
   Xcode 27 agent skills (SwiftUI specialist, SDK-27 changes, test
   modernization, device driving, …) install as stubs; one script extracts
   the real content from your own Xcode, and a SessionStart hook nudges
   until it has run.

## Install

```
/plugin marketplace add jlreyes/swift-agent-kit
/plugin install swift-agent-kit@swift-agent-kit
```

Then start a session: the hook prints the path of
`scripts/extract-apple-skills.sh` (Xcode 27+, ~5s) — run it, or ask the
agent to. Extracted skill bodies are picked up immediately; the notice
disappears once extraction has run. Re-run after plugin or Xcode updates
(the hook reminds you).

Wire up Xcode's MCP server (one-time; Xcode must be running when a session
starts for its tools to enumerate):

```bash
claude mcp add --scope user xcode-tools \
  --env DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
  -- /Applications/Xcode-beta.app/Contents/Developer/usr/bin/mcpbridge
```

Recommended companions:

- `~/.claude/CLAUDE.md` push layer (skills don't auto-load for
  familiar-looking tasks — measured, not vibes): *"For any Swift work,
  load swift-agent-kit:swift-standards first. For any @State compile error
  after an SDK update, consult swift-agent-kit:swiftui-whats-new-27 before
  proposing a fix."*
- Toolchain permissions in `~/.claude/settings.json`: `Bash(swift:*)`,
  `Bash(xcodebuild:*)`, `Bash(xcrun:*)`, `Bash(xcodegen:*)`.
- [instruments-analyzer](https://github.com/jlreyes/instruments-analyzer)
  — the performance half of the loop: programmatic Instruments-trace
  analysis (DuckDB/SQL). This kit makes the agent write and verify correct
  Swift; that one lets it diagnose why frames drop.

## What's included

| Path | Description |
|------|-------------|
| `skills/swift-standards/` | Doctrine + per-topic references (ours, MIT) |
| `skills/apple-docs/` | Doc-lookup recipes + DocumentationSearch routing (ours, MIT) |
| `skills/xcode-tools/` | Xcode MCP operating guide + per-tool verdicts (ours, MIT) |
| `skills/apple-api-updates/` | Routing wrapper for Apple's 20 API-update guides (wrapper ours; guides extracted) |
| `skills/<ten Apple skills>/` | Stubs with our trigger descriptions until extracted |
| `scripts/extract-apple-skills.sh` | Official export + framework copies + binary carve, stamped with your Xcode build |
| `scripts/check-apple-content.sh` + `hooks/hooks.json` | SessionStart nudge until extraction has run |

## License

Original content MIT. Apple-authored content is never in this repository
or its history — the extraction script places it on your machine under
your own Xcode license (internal use). Don't commit extracted content
back; PRs containing Apple-authored skill bodies will be closed.

## Status

Built against Xcode 27.0 beta (27A5194q). The operating guide and routing
rules are empirical (live probing + headless routing tests) and will drift
as betas rev — re-extract after Xcode updates; issue reports welcome.
