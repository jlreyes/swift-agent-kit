# swift-agent-kit

Skills, lessons, and pitfalls from a year of building a complex Swift app
with an agentic CLI as the primary editor and Xcode as an attached worker.
Agents are bad at Swift in specific, fixable ways — they write last year's
patterns, can't tell a new API from a hallucinated one, and drive Xcode's
tooling badly. This kit bundles the fixes.

## What it does

1. **Avoids common Swift pitfalls** (`swift-standards`) — the mistakes
   agents actually make, collected from a year of reviews: legacy patterns
   (ObservableObject, DispatchQueue, completion handlers, XCTest), Swift 6
   concurrency violations, SwiftUI invalidation blowups, preview-breaking
   code, SwiftData actor misuse.
2. **Provides *all* the documentation** (`apple-docs` + `apple-api-updates`)
   — teaches the agent to fetch what it doesn't know instead of guessing:
   exact signatures and availability from your selected SDK (with a
   falsification check after checking module, platform, and headers), DocC
   prose and code examples, the HIG, WWDC transcripts, Swift Evolution, and
   Apple's API-update guides — plus when each beats Xcode's built-in
   `DocumentationSearch` (measured, not guessed: semantic search can never
   say "no such API").
3. **Exposes Xcode's built-in skills** — materializes the 15 Apple Xcode 27
   skills from *your* Xcode, while retaining this kit's Dynamic Type
   implementation guide. Apple’s license doesn't permit shipping that
   content, so the installer uses your local Xcode as the source and keeps
   the kit’s short, portable trigger descriptions.
4. **Drives Xcode as a worker** (`xcode-tools`) — build, test, debug (a
   real lldb into the running app), render previews, and tap through the
   simulator over Xcode's MCP server, with a division-of-labor guide built
   from ~190 live probe calls: which jobs belong to the agent's native
   tools, which to Xcode's dynamically discovered MCP tools, which to the CLI.
5. **Makes Instruments programmable** — embeds
   [instruments-analyzer](https://github.com/jlreyes/instruments-analyzer)
   (auto-installed; vendored via git subtree): export `.trace` files to
   DuckDB and let the agent diagnose hitches, hangs, and dropped frames
   with SQL.

## Install

### Claude Code (recommended)

```
/plugin marketplace add jlreyes/swift-agent-kit
/plugin install swift-agent-kit@swift-agent-kit
```

Recommended because this route also ships a SessionStart hook: until
Apple's skills have been extracted, every session starts with the exact
command to run (ask the agent to run it — Xcode 27+, ~5s). The
`marketplace.json` here is just Claude Code's mechanism for making a repo
directly installable; there is no marketplace to maintain.

### Any agent, via skills.sh

```bash
npx skills add jlreyes/swift-agent-kit
~/.claude/skills/apple-api-updates/scripts/extract-apple-skills.sh
```

Hooks aren't part of the open skills standard, so there's no automatic
nudge on this route — but the stub skills carry the same instructions, so
an agent that triggers one self-heals.

Running Claude Code AND another agent on one machine? Install the plugin
for Claude Code and skills.sh for the others — but note recent Claude Code
versions may also surface `~/.agents/skills/` entries unnamespaced,
duplicating the plugin's. If you see doubles, hide the unnamespaced ones
via `skillOverrides` in `~/.claude/settings.json`, or pick one route.

### Codex and other harnesses

The skills — including the stub + extraction flow — follow the Agent
Skills open standard and work in Codex, Cursor, and friends via the
skills.sh route. Claude-Code-only pieces: the SessionStart hook and the
one-command plugin install. Xcode's MCP server works in any MCP-capable
harness (point your harness's MCP config at `mcpbridge`); note that our
docs print tool names in Claude Code's `mcp__xcode-tools__*` convention —
adjust the prefix for yours.

After extraction, run `/reload-plugins` (or start a new session) — skill
bodies are cached per session, and agents can't run slash commands, so the
agent will answer from the extracted files directly and ask you to reload.
Re-run the script after Xcode or plugin updates.

Wire up Xcode's MCP server (one-time):

```bash
claude mcp add --scope user xcode-tools \
  -- xcrun mcpbridge
```

For Codex:

```bash
codex mcp add xcode-tools -- xcrun mcpbridge
```

Xcode 27’s MCP service can start on demand in headless mode. Check its state
with `xcrun mcp-server status`. When service setup is authorized, enable it
with `sudo xcrun mcp-server enable` using normal admin approval; do not alter
permission grants outside the authorized scope or use
`--unsafe-always-allow-all-agents` by default. Opening a workspace may request
scoped permission for the signed agent and its directory.

The materializer refuses to write Apple content into a Git checkout. Run it
from an installed copy of the kit; for a disposable local copy, pass
`--skills-dir <separate-skills-directory>` to
`extract-apple-skills.sh`.

Recommended companions:

- `~/.claude/CLAUDE.md` push layer (skills don't auto-load for
  familiar-looking tasks — measured, not vibes): *"For any Swift work,
  load swift-agent-kit:swift-standards first. For any @State compile error
  after an SDK update, consult swift-agent-kit:swiftui-whats-new-27 before
  proposing a fix."*
- Toolchain permissions in `~/.claude/settings.json`: `Bash(swift:*)`,
  `Bash(xcodebuild:*)`, `Bash(xcrun:*)`, `Bash(xcodegen:*)`.

## What's included

| Path | Description |
|------|-------------|
| `skills/swift-standards/` | Doctrine + per-topic references (ours, MIT) |
| `skills/apple-docs/` | Doc-lookup recipes + DocumentationSearch routing (ours, MIT) |
| `skills/xcode-tools/` | Xcode MCP operating guide + per-tool verdicts (ours, MIT) |
| `skills/apple-api-updates/` | Routing wrapper + the extraction script (`scripts/extract-apple-skills.sh`) |
| `skills/instruments-analyzer/` | Instruments → DuckDB trace analysis (embedded upstream, MIT) |
| `skills/<Apple skills>/` | Stubs with our trigger descriptions until materialized from Xcode |
| `scripts/`, `hooks/` | Plugin-root wrapper + SessionStart nudge (Claude Code route) |

## Licensing

Original content MIT; `skills/instruments-analyzer/` carries its own MIT
license. Apple-authored content is **never** in this repository or its
history — the extraction script places it on your machine under your own
Xcode license (internal use). Don't commit extracted content back; PRs
containing Apple-authored skill bodies will be closed.

## Maintenance

- Built against Xcode 27.0 (27A266a), refreshed from the June beta baseline
  (27A5194q). The operating guide retains dated beta observations where they
  have not been re-run; re-materialize skills and refresh MCP inventory after
  Xcode updates.
- [Xcode 27 compatibility](docs/xcode-27-compatibility.md) records the
  release schema, skill parity, and the limits of the local verification.
- Installer fixtures: `python3 -m unittest discover -s tests -v`. With Xcode
  27 installed, `python3 tests/verify_local_xcode.py` also materializes both
  supported layouts in temporary directories and checks their local parity.
- Updating a skills.sh install: `npx skills add` does NOT refresh skill
  directories that already exist — remove the kit's skill dirs from
  `~/.agents/skills/` (or your agent's skills dir) first, then re-add and
  re-run the extraction script.
- Pull instruments-analyzer upstream:
  `git subtree pull --prefix=skills/instruments-analyzer https://github.com/jlreyes/instruments-analyzer.git main --squash`
