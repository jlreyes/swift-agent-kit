# xcode-tools — per-tool verdicts & empirical nuances

Format: **verdict** (when Claude Code should/shouldn't reach for it), then
only nuances you can't learn from the tool's own schema — read the schema
too; Xcode 27's schemas are good and this file doesn't repeat them.
Observed on Xcode 27.0 beta (27A5194q) across two audit passes, ~190 live
calls. Timings come from the tools' own `elapsedTime` where available.

Contents: §Workspace · §Files · §Diagnostics/build · §Snippets/tests ·
§Run/debug/console · §Previews · §Settings/config · §Localization · §Device ·
§Services

## §Workspace

**XcodeListWindows** — USE once at bootstrap. Output is plain text inside
`message` (`* tabIdentifier: windowtab2, workspacePath: …`), one line per
window — regex it, there are no structured fields. Multiple windows: match
on `workspacePath`.

**XcodeListSchemes** — SKIP unless multi-scheme confusion; the switch tools
already return `activeSchemeName`.

**XcodeSwitchScheme / XcodeSwitchRunDestination** — USE sparingly: these
change the HUMAN's Xcode UI state and it stays changed. Idempotent
re-selects are quiet no-ops (verified).

**XcodeListRunDestinations** — AVOID (~15KB inline, 40-entry cap of 100+).
Only for changing device class; otherwise read the active destination from
a switch-tool response.

**XcodeGetCurrentFile** — USE only to answer "what is the user looking at /
editing?" — the one capability with no native equivalent.
`{"isEditable":false}` = no editor focus. Remote MCP edits never change it.

**XcodeListNavigatorIssues** — USE after a build for a cross-file sweep
including package-resolution/workspace issues (which GetBuildLog lacks);
`vitality:"fresh"|"stale"` tells you whether an issue predates the last
build. Defaults to `severity:"error"` — pass `"warning"` or it looks empty
on a warnings-only project. Paths come back filesystem-absolute.

## §Files

Verdicts: in SwiftPM packages use native tools for everything here. In
.xcodeproj projects: reads/searches/content-edits → native; file LIFECYCLE
(create/delete/move/rename) → these tools, for pbxproj membership.

Input paths: canonical `ProjectName/Group/File.swift`; bare suffixes
(`Sources`) resolve; absolute filesystem paths are auto-mapped with a
scolding `message`. Root `XcodeLS` shows a virtual `Products/` group.

**XcodeRead** — SKIP. Native Read gives the same bytes without the MCP hop,
JSON-escaped payload, or `tabIdentifier` ceremony. (Both tools' line counts
are defaults, not caps — `limit` raises either.)

**XcodeGlob / XcodeGrep / XcodeLS** — SKIP for content; XcodeLS only for
group-structure questions. XcodeGrep nuances: `matchCount` counts matches
while `results` lists lines (they diverge on multi-match lines), and when
`path` targets a single file the result paths duplicate the filename
(`…/Warnings.swift/Warnings.swift:1:…`) — don't parse them as real paths.

**XcodeWrite** — USE for new files in .xcodeproj: creates on disk AND
registers in project/target (`wasExistingFile` in response). Native Write
leaves the file invisible to the build.

**XcodeUpdate** — SKIP for content edits (native Edit is safer): on an
ambiguous match it silently replaces the FIRST occurrence and reports
success (`editsApplied:1`); native Edit errors instead. Its no-match
failure is genuinely helpful — `success:false` plus a fuzzy closest-match
hint with similarity % and line number.

**XcodeMV** — USE for rename/move in .xcodeproj; auto-detects rename vs
move. The schema's `operation` enum includes `copy` but it's dead: passing
it is silently ignored and the file is renamed anyway (verified) — never
rely on it to copy.

**XcodeRM** — USE for deletes in .xcodeproj (reference-consistent,
trash-recoverable per schema); `recursive:true` required for directories.

**XcodeMakeDir** — USE when creating folders in .xcodeproj (folder + group).

## §Diagnostics & build

**XcodeRefreshCodeIssuesInFile** — USE for per-file diagnostics without
touching build artifacts; it surfaces MORE than the compiler emits
(sourcekit 4 vs compiler 2 on the same file) and needs no build. But it is
NOT instant: ~7–10s observed on a small project — on warm small projects a
null `BuildProject` (0.1s) or incremental build (~4s) is faster AND
authoritative across files. Reach for it when a build is undesirable
(dirty intermediate state, huge project) rather than reflexively.

**BuildProject** — USE as the standard build. Always active scheme +
destination, always incremental — NO clean option; for clean builds or
flag overrides shell out to `xcodebuild`. Quiet: summary + `errors[]`
(filesystem-absolute paths) + `fullLogPath`. Self-reports `elapsedTime` —
quote it instead of guessing (null build 0.1s; small warm compile ~4s;
plan-stage failures fail fast ~0.4s).

**GetBuildLog** — USE to root-cause; reflects the LAST build (including one
the human ran, and a null build does NOT clear it — unchanged tasks and
their warnings persist). Default `severity:"error"` hides warnings (empty ≠
clean). `pattern` matches message/task/cmdline/console; `glob` matches
paths. Test-runner "Build action failed" errors are diagnosed HERE.

## §Snippets & tests

**RunCodeSnippet** — USE to probe behavior in project context. ~15–25s,
self-building, output is stdout-only (`executionResults`) — print what you
want to learn; no value channel. The schema asks that `purpose` avoid the
word "test" (so the UI doesn't mislead the user) but it is NOT validated —
phrasing it differently is politeness, not a requirement.

**GetTestList** — USE to get exact identifiers before RunSomeTests. Swift
Testing identifiers include parens: `MathTests/addition()`. Test file paths
are project-relative here (unlike build tools' absolute paths).

**RunSomeTests / RunAllTests** — USE for .xcodeproj/simulator testing
(structured `counts`, per-test `state` + `errorMessages`, `.xcresult`
path). Self-building. Cost is dominated by simulator state: ~14s with a
warm sim, 45s+ cold — once the sim is booted (e.g. after any device work),
tests are cheap; don't let "slowest rung" defer them. Misconfigured test
targets surface as an opaque MCP error ("Build action failed. Inspect
build logs.") — go to GetBuildLog (observed cause: test target missing
GENERATE_INFOPLIST_FILE). For pure SwiftPM repos prefer `swift test` CLI.

## §Run, debug, console

**RunProject** — USE to launch. Pass `attachDebugger:true` whenever
debugging might follow — relaunching later wastes a cycle. Returns after
launch (`processIdentifier`, `launchSessionReference`, self-reported
`elapsedTime`; 0.2–2s warm, minutes on cold sim boot) while the app keeps
running. **StopProject** pairs with it — note it also stops a run the
human started.

**GetConsoleOutput** — USE for stdout/print of Xcode-launched sessions
(that output never reaches unified logging, so `log show` can't see it)
and for session-scoped OSLog without predicate-writing. Defaults: latest
session, 500-line tail; `totalCount:0` from a quiet app is normal. Nuances:
test runs register as their own launch sessions (after RunSomeTests the
"latest" session is the test bundle, `State: expired`, containing the Swift
Testing transcript) — pass `launchSessionReference` to get back to the app;
your own InvokeDebuggerCommand I/O appears in the app session's `stdio`
units. For processes YOU launched via CLI, use `log show` instead.

**InvokeDebuggerCommand** — THE unique capability; the human sees your
commands in their debug console, so clean up breakpoints and `continue`
when done. Workflow: RunProject(attachDebugger:true) → `process interrupt`
→ expressions → `continue`. While running, expressions refuse with
"Process is running. Use 'process interrupt'". When paused in a non-Swift
frame, lldb ANNOUNCES its fallback — `note: Falling back to default
language. Ran expression as 'Objective C++'.` followed by type errors —
that note is your cue to use ObjC syntax or `frame select` a Swift frame
first. Quirk: `output` text arrives duplicated on every call.

## §Previews

**RenderPreview** — USE for visual verification of any `#Preview` without
launching the app: ~20–30s, self-building, returns a device-aspect PNG
path (view it) plus `supportedLocalizations` and
`supportedPreviewVariantOverrides` (Color Scheme / Dynamic Type /
Orientation) — call once to DISCOVER variants, again with
`previewVariantOverrides` to render them. The `previewCanvasControlOverrides`
input (timelineIndex/toggleState) only applies to Widget/Live-Activity
previews; plain views return no canvas overrides. (Verified on iOS
targets; untested on Mac-only targets.)

## §Settings & config

**GetTargetBuildSettings** — the noise king: ~27KB/~420 settings inline, no
filter. USE via subagent or once-per-session; `targetValue` present only
where set at target level. Never parse/modify pbxproj directly — use the
update tools.

**UpdateTargetBuildSetting** — USE for setting changes. Success returns
**empty `{}`**; to verify one key, `xcodebuild -showBuildSettings | grep
<SETTING>` is far cheaper than re-fetching the 27KB dump. Rejects unknown
setting names with a hard error ("Unknown build setting: …") — it cannot
create user-defined settings the way the Xcode UI can.

**GetFileCompilerFlags / UpdateFileCompilerFlags** — RARELY USE: for .swift
files per-file flags are typically ignored (module compilation); both the
schemas and every response's `warning` field say so. Prefer
OTHER_SWIFT_FLAGS via target settings.

**AddInfoPlist** — USE over hand-editing: unknown keys succeed WITH an
advisory (`errorDescription` despite `result:true` — read it). Side
effect: creates `<Target>-Info.plist` + sets `INFOPLIST_FILE`, keeping
`GENERATE_INFOPLIST_FILE=YES` (Xcode merges both).

**AddEntitlement** — USE over hand-editing: validates against a real
per-platform entitlement database; invalid key → `result:false` with "DO
NOT tell the user to add this manually" — respect the refusal. Valid key
creates `<Target>.entitlements` + sets `CODE_SIGN_ENTITLEMENTS`.

## §Localization

All four tools' schemas demand `xcode-integration:*` skills that don't
exist outside Xcode — every tool works fine without them (verified); the
vendored `translation`/`translation-coordinator` skills are the
equivalents.

**LocalizationPlanner** — CAUTION, a mutating re-extraction, not a
read-only planner: preparing a locale rewrote the existing catalog
(dropped a hand-authored key absent from source; normalized `%lld` → `%@`)
and created `<Target>-InfoPlist.xcstrings`. Run on a clean tree and diff
after.

**StringCatalogRead** — USE for state counts/keys. Without
`requestedState`: counts only, plus a `nextStep` coaching string.
Unprepared locale is NOT an error (everything shows as `new`).

**StringCatalogContext** — USE before translating a key: exact source
attribution (file/line/column), usage hints, plural cases. Unique data.

**StringCatalogEdit** — USE for writing translations; nuance: simple
`translation:` writes state **`machine_translated`**, not `translated`
(verified on disk) — reads count it accordingly. Prefer these tools over
native-editing the .xcstrings JSON: they maintain the state machine and
extraction sync.

## §Device (iOS Simulator 27.0+ only — verified live)

Requires an iOS 27+ simulator runtime; with only older runtimes every
StartSession fails fast ("Supported: iOS [Simulator] 27.0+"), and Mac is
explicitly unsupported (probed: "My Mac" → refused). Full verified pass:
9 calls, ~3.4 min wall including all captures.

**DeviceInteractionStartSession** — ~15–25s against a booted device.
Returns `{deviceIsSimulator, deviceUUID, interactionSessionKey,
skillToTrigger, summary}`. The session key is NOT server-generated — it's
your own `sessionIdentifier` echoed back. **Recently-used identifiers are
refused** ("This session identifier is currently in use or was recently
used") — after a crash, pick a fresh name. The `summary` orders you to
spawn a subagent loading the `device-interaction` skill (`skillToTrigger`)
— direct driving works without it. Bogus `deviceIdentifier` → error
listing supported targets (usable as discovery).

**DeviceInteractionInstallAndRun** — ~13s warm (build+install+launch).
Returns ONLY `{"userMessage":"Application installed and running"}` — no
pid, no session ref (use GetConsoleOutput's latest session for the pid).
Prefer its `commandLineArguments`/`environmentVariables` (with
`$(inherited)`) over editing the scheme: one-run-only effect.

**DeviceInteractionSynthesize** — param is `interactSessionKey` (Start/
InstallAndRun/End use `interactionSessionKey`, and Synthesize takes no
`tabIdentifier` — inconsistency confirmed in schemas and live). Every call
returns `applicationState` plus FOUR artifact paths: `hierarchyPath`,
`screenshotPath`, `thumbnailScreenshotPath`, and `logsPath` (app
stderr/console — useful for crash triage). Empty `interactionCommand` =
capture-only. Hierarchy format: header lines (orientation, bundle id,
pid), then an indented tree of `Type, {{x, y}, {w, h}}, label: '…',
center: {cx, cy}` in POINTS (402×874 on iPhone 17 Pro); after typing, a
TextField line gains `value: hello, Keyboard Focused`. Verified: tap by
`center:` works (`t 201 422` incremented the counter); **commands chain in
one call** (`t 201 473 w 0.3 sender keyboard kbd hello` = tap, wait,
type); the keyboard SHIFTS every center (field moved 473→322) — recapture
before further taps. `b h` backgrounds the app but `applicationState`
stays `"Running"` — it's process state, not foregroundness. Grammar:
`t x y [dur]` · `d x y` · `t x1 y1 f x2 y2 [dur]` swipe · `b h|p|u|d` ·
`sender keyboard kbd <text>` (must be last; `\u{000A}` = return) · `w dur`
· `orientation <name>`.

**DeviceInteractionEndSession** — `{"userMessage":"Session stopped"}`.
Always call it; sessions are resource-heavy.

## §Services

**DocumentationSearch** — USE for discovery of VOCABULARY (what is this
API called), never for truth. Empirical: exact-symbol queries rank related
pages above the symbol's own page; fabricated API names return 20
confident results, and scores DON'T separate fake from real (a fake UIKit
class topped at 0.629 — no usable threshold exists). Verify anything you
plan to write against the SDK-interface grep or a diagnostics check.
Corpus includes API reference, HIG, and tutorials (full routing: the
apple-docs skill). ~12KB/query with a `frameworks` filter, ~30KB without.

**GetTopCrashIssues / GetCrashIssueLogs / GetTopFieldPerformanceIssues /
GetFieldPerformanceIssueLogs** — only useful for apps "connected in Xcode
Organizer" (shipped, with field data); otherwise graceful `success:false`.
Always pass `bundle_id` explicitly — the auto-resolve-from-scheme claim is
false in practice for both families (verified: "Missing required
parameter: bundle_id"). Responses embed Apple's triage guidance when data
exists.
