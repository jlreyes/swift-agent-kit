---
name: apple-api-updates
description: >-
  Apple-authored adoption guides for the iOS/macOS 26 generation of SDK
  features (WWDC 2025 era), which post-date most model training data. Covers
  adopting Liquid Glass design in SwiftUI, UIKit, AppKit, and WidgetKit; the
  FoundationModels on-device LLM framework; Swift 6.2 concurrency updates;
  InlineArray and Span; AppIntents and StoreKit updates; SwiftData class
  inheritance; Foundation AttributedString updates; SwiftUI toolbar features,
  styled text editing, WebKit integration, and AlarmKit alarms; 3D Swift
  Charts; widgets for visionOS; Visual Intelligence; Assistive Access; and
  MapKit/GeoToolbox place descriptors. Use when writing or reviewing code
  that touches these frameworks or features, when an API in these areas
  cannot be found and might be newer than training data, or when asked what's
  new in the iOS/macOS 26 SDKs. SDK-27 SwiftUI changes live in
  swiftui-whats-new-27; what's-new for any other framework or release goes
  through apple-docs.
license: Apple-copyrighted reference content; private personal use only — do not redistribute.
metadata:
  author: jlreyes
  source: Xcode 27.0 beta (27A5194q) — IDEIntelligenceChat.framework AdditionalDocumentation
---

# Apple API Updates

These reference guides were written and published by Apple (shipped inside
Xcode for model-context injection). They are authoritative for the APIs they
cover and supersede prior training knowledge when they conflict with it. Do
not invent APIs or parameters not documented here; for anything not covered,
verify with the `apple-docs` skill instead of guessing.

Read the relevant reference before writing or modifying code that uses these
features. Each file is self-contained.

SDK 27 note: these guides are the iOS/macOS 26 layer. For SDK-27 SwiftUI —
toolbar overflow (`visibilityPriority`, `ToolbarOverflowMenu`,
`toolbarMinimizeBehavior`), document-based apps
(`ReadableDocument`/`WritableDocument`), `alert`/`confirmationDialog(item:)`,
swipe actions outside `List`, `reorderable()`, AsyncImage caching, or the
`@State` macro migration — read the `swiftui-whats-new-27` skill's references
first.

## References

Design system (Liquid Glass):
- `references/SwiftUI-Implementing-Liquid-Glass-Design.md` — adopting Liquid Glass in SwiftUI: materials, glass effects, control styling.
- `references/UIKit-Implementing-Liquid-Glass-Design.md` — the UIKit equivalents.
- `references/AppKit-Implementing-Liquid-Glass-Design.md` — the AppKit equivalents.
- `references/WidgetKit-Implementing-Liquid-Glass-Design.md` — Liquid Glass in widgets.

Swift language & standard library:
- `references/Swift-Concurrency-Updates.md` — Swift 6.2 concurrency: default MainActor isolation mode, `@concurrent`, `nonisolated(nonsending)`, migration guidance.
- `references/Swift-InlineArray-Span.md` — `InlineArray` and `Span`: fixed-size stack allocation and safe contiguous-memory views.

Machine learning:
- `references/FoundationModels-Using-on-device-LLM-in-your-app.md` — the FoundationModels framework: sessions, `@Generable` structured generation, tool calling, streaming.

SwiftUI features:
- `references/SwiftUI-New-Toolbar-Features.md` — toolbar spacers, item visibility, customization.
- `references/SwiftUI-Styled-Text-Editing.md` — rich text editing with `AttributedString` in `TextEditor`.
- `references/SwiftUI-WebKit-Integration.md` — native `WebView`/`WebPage` in SwiftUI.
- `references/SwiftUI-AlarmKit-Integration.md` — scheduling alarms/timers with AlarmKit from SwiftUI.

Data & persistence:
- `references/SwiftData-Class-Inheritance.md` — modeling class hierarchies in SwiftData.
- `references/Foundation-AttributedString-Updates.md` — AttributedString API updates.

Frameworks:
- `references/AppIntents-Updates.md` — AppIntents updates (interactive snippets, entity views).
- `references/StoreKit-Updates.md` — StoreKit updates.
- `references/Swift-Charts-3D-Visualization.md` — 3D charts with `Chart3D`.
- `references/MapKit-GeoToolbox-PlaceDescriptors.md` — `PlaceDescriptor` for cross-service place identity.

Platform features:
- `references/Widgets-for-visionOS.md` — widgets on visionOS.
- `references/Implementing-Visual-Intelligence-in-iOS.md` — integrating with Visual Intelligence search.
- `references/Implementing-Assistive-Access-in-iOS.md` — Assistive Access scenes and constraints.

## References missing?

If `references/` is empty, the guides haven't been extracted from your
local Xcode yet — run `scripts/extract-apple-skills.sh` at this plugin's
root, then re-invoke this skill.
