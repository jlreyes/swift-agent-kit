# Project organization

How to decide where Swift app code goes and what to call it. Six principles
carry the reasoning. The examples after them show each principle on disk in a
shipping app, and the last section shows what each approach cost those apps.
The examples disagree with each other, so read them as evidence for the
principles, not as layouts to copy. A project that already has a layout keeps
it.

Several of these apps still use `ObservableObject` and Combine. Take the file
layout from them and the observation rules from the rest of this skill.

## Principles

**Code that changes together lives together.** A change to a screen touches
its view, its state, and its actions in one sitting. When those sit in three
top-level folders named `Models`, `Views`, and `ViewModels`, every change
crosses all three, and each folder mixes unrelated features. None of the apps
below splits its top level that way. Group by the thing a person would name:
a screen, a feature, a platform capability.

**"Model" means two different things.** One is the state of a screen: the
text in a field, whether a spinner shows, which alert is up. The other is
product data: an account, a message, a vault item. Screen state belongs to
its screen and goes away with it. Product data has one owner that many
screens read. Filing both under `Models` hides which is which.

**Structure is a cost, paid against complexity.** Each file or type between a
tap and its effect is one more thing to read, name, and keep in step with the
rest. A screen that paginates, streams, and cancels has enough behavior to
fill a model of its own. A settings toggle does not. Add the file when the
behavior exists, not because the previous screen had one.

**A module marks a real dependency or runtime boundary.** A Swift package
target can stop one part of the code from seeing another and can build without
it. That is worth a manifest entry and the access-control work when a second
executable or platform consumes the code, or when one target must never link
another. For finding things inside one target, a folder does the job.

**A central owner fits a focused app and strains as the app grows.** One
object that creates and holds every long-lived part makes startup order and
lifetime easy to see. It also gives every part a path to every other part.
The more features hang off it, the harder it is to change one without reading
the rest.

**Where code lives is mostly settled; how state flows is not.** Every app
below groups code by feature, screen, or capability. They split sharply on
state: plain `@Observable` models, view models behind protocols, typed stores
with actions and effects, reducers. Decide the folder question on its own. It
does not commit a project to any of those state approaches.

## Examples

### Element X: a screen is a folder

```text
ElementX/Sources/
  Screens/Authentication/LoginScreen/
    LoginScreenModels.swift
    LoginScreenViewModel.swift
    LoginScreenViewModelProtocol.swift
    LoginScreenCoordinator.swift
    LoginHomeserver.swift
    LoginMode.swift
    View/LoginScreen.swift
  Services/
    Authentication/
    Client/
```

Everything for the login screen is in [one folder][ex-login], and every file
carries the screen's name, so a search for `LoginScreen` finds the whole set.
That is code that changes together living together.
[`LoginScreenModels.swift`][ex-models] shows the split between screen state
and product data. It holds `LoginScreenViewState`, with the selected
homeserver, an `isLoading` flag, and the typed username and password, plus
enums for what the view can ask for. None of it is account data. The
authentication service that the view model receives lives apart, under
`Services/Authentication/`.

### Bitwarden: the same shape with stricter roles

```text
BitwardenShared/
  Core/
    Auth/  Autofill/  Billing/  Platform/  Tools/
    Vault/
      Models/  Repositories/  Services/
  UI/
    Auth/  Autofill/  Billing/  Platform/  Tools/
    Vault/Vault/VaultList/
      VaultListView.swift
      VaultListState.swift
      VaultListAction.swift
      VaultListEffect.swift
      VaultListProcessor.swift
      VaultListProcessorTests.swift
```

The first split is `Core` against `UI`, and both sides are divided into the
same six product areas. Product data and repositories sit in `Core/Vault/`,
and screen state sits in the screen's folder as
[`VaultListState.swift`][bw-state]. The directories themselves keep the two
kinds of "model" apart. Inside [`VaultList/`][bw-list] the files again carry
the screen's name, and the suffix names each file's part in the flow. The view
sends a `VaultListAction` to a store, and the processor handles it. Tests sit
beside the file they cover.

### Ice Cubes: features as packages, light state inside them

```text
Packages/
  Models/  NetworkClient/  Env/  DesignSystem/
  Account/  Timeline/  StatusKit/  Notifications/  Explore/  Lists/
  Timeline/Sources/Timeline/
    View/TimelineView.swift
    View/TimelineViewModel.swift
    View/TimelineListView.swift
    actors/TimelineDatasource.swift
    actors/TimelineCache.swift
    TimelineFilter.swift
```

Product data, the API client, shared environment objects, and shared UI are
each a package. A feature package such as `Timeline` depends on them and they
do not depend on it. [`TimelineView`][ic-view] reads the client, the current
account, and the theme from `@Environment` and holds its model in `@State`.
[`TimelineViewModel`][ic-model] is an `@Observable` class that pages, pulls to
refresh, and handles stream events. The model exists because the behavior
does. The project's own [contributor guide][ic-guide] tells new features not
to create view models and calls the existing ones legacy.

### Ice: capabilities as folders

```text
Ice/
  Main/
    IceApp.swift
    AppState.swift
  MenuBar/
  Hotkeys/
  Permissions/
    Permission.swift
    PermissionsManager.swift
    PermissionsView.swift
    PermissionsWindow.swift
  Events/
  Settings/
  UI/
```

Ice is a Mac menu bar utility, and most of its code is not screens. The
[top-level folders][ice-root] name what the app does to the system: menu bar,
hotkeys, permissions, events. `Permissions/` holds the type, the manager, the
view, and the window for that one capability. It is the same grouping by
what a person would name, where the thing named is a system integration
instead of a feature.

### Sill: targets where the build needs them

```text
Package.swift
Sources/
  StreamProtocol/      wire types, the only library product
  SillHost/            Mac capture and streaming, target SillHostCore
  SillHostCLI/         command-line executable
  SillMenuBar/         Mac app, including AppModel.swift
iOSClient/             iOS app
```

[`Package.swift`][sill-pkg] gives the reason for each boundary in comments.
The command-line tool and the menu bar app are separate executables that both
depend on `SillHostCore`. `SillHostCore` is deliberately not exported as a
product, because the iOS project links this package and must never see the
Mac host code. Each target exists because an executable or a platform needs it
to. [`AppModel`][sill-model] is one `@MainActor @Observable` class for the
menu bar app's state, and the capture and streaming work stays in
`SillHost/StreamCoordinator.swift`.

### isowords: the module boundary taken to its limit

The [isowords README][iso-readme] counts 86 modules and states what they buy:
working on one feature without building the whole app, shorter compile times,
more stable previews, and an App Clip that stays under its 10 MB limit by
including only the modules it needs. Every one of those is a build reason, and
none of them is about finding files.

## Where each approach cost something

**Bitwarden's split sorted the complexity without shrinking it.**
[`VaultListProcessor.swift`][bw-proc] is 1,063 lines and declares 20 service
dependencies. `VaultListView.swift` is 955 lines. Five role files per screen
tell a reader where each kind of code goes. They did not keep this screen
small. Structure organizes behavior; it does not reduce it.

**Element X pays the full set for a small screen.** The login screen is a
username field, a password field, and a button, in seven files.
`LoginScreenViewModelProtocol.swift` is 17 lines. `LoginScreenCoordinator`
subscribes to the view model's two actions and sends each one on again under
the same name. The repository has 79 screen coordinators and 78 view model
protocols under `Screens/`, so a screen pays for the set whether or not it
has behavior to fill it.

**Ice's central object can reach everything.** [`AppState`][ice-state]
creates nine long-lived objects, eight managers and an image cache, and
passes itself to each one. Every manager can reach every other manager
through it. Ice is one focused utility and this works there. In an app with
many independent features, the same object would make each feature depend on
all the others, which is why `AppState` is not a pattern to carry over.

**Ice Cubes is still retiring its view models.** The contributor guide says
new features should not use view models and describes the existing ones as
being phased out. `TimelineViewModel.swift` is still there at 719 lines. A
template applied to every screen has to be removed from every screen.

## Sources

Files were read on 2026-11-06 at the commits below. Line counts and file
lists are as of those commits.

| Repository | Commit |
| --- | --- |
| [element-hq/element-x-ios](https://github.com/element-hq/element-x-ios/tree/e8ddd6ad2a70ddd2e3b87125adba0f8e31025af5) | `e8ddd6a` |
| [bitwarden/ios](https://github.com/bitwarden/ios/tree/e027ab3d6c7c19418e6cdb8bc40060f1214d1d00) | `e027ab3` |
| [Dimillian/IceCubesApp](https://github.com/Dimillian/IceCubesApp/tree/98098b9c4b5928f89f338203193c2bf40ab7f38c) | `98098b9` |
| [jordanbaird/Ice](https://github.com/jordanbaird/Ice/tree/11edd39115f3f43a83ae114b5348df6a0e1741cf) | `11edd39` |
| [Saffsanity/sill](https://github.com/Saffsanity/sill/tree/41e8cb8801f8e9d387e27a0d498dee193d17e9ec) | `41e8cb8` |
| [pointfreeco/isowords](https://github.com/pointfreeco/isowords/tree/c727d3a7c49cf0c98f2fa4f24c562f81e30165f7) | `c727d3a` |

[ex-login]: https://github.com/element-hq/element-x-ios/tree/e8ddd6ad2a70ddd2e3b87125adba0f8e31025af5/ElementX/Sources/Screens/Authentication/LoginScreen
[ex-models]: https://github.com/element-hq/element-x-ios/blob/e8ddd6ad2a70ddd2e3b87125adba0f8e31025af5/ElementX/Sources/Screens/Authentication/LoginScreen/LoginScreenModels.swift
[bw-list]: https://github.com/bitwarden/ios/tree/e027ab3d6c7c19418e6cdb8bc40060f1214d1d00/BitwardenShared/UI/Vault/Vault/VaultList
[bw-state]: https://github.com/bitwarden/ios/blob/e027ab3d6c7c19418e6cdb8bc40060f1214d1d00/BitwardenShared/UI/Vault/Vault/VaultList/VaultListState.swift
[bw-proc]: https://github.com/bitwarden/ios/blob/e027ab3d6c7c19418e6cdb8bc40060f1214d1d00/BitwardenShared/UI/Vault/Vault/VaultList/VaultListProcessor.swift
[ic-view]: https://github.com/Dimillian/IceCubesApp/blob/98098b9c4b5928f89f338203193c2bf40ab7f38c/Packages/Timeline/Sources/Timeline/View/TimelineView.swift
[ic-model]: https://github.com/Dimillian/IceCubesApp/blob/98098b9c4b5928f89f338203193c2bf40ab7f38c/Packages/Timeline/Sources/Timeline/View/TimelineViewModel.swift
[ic-guide]: https://github.com/Dimillian/IceCubesApp/blob/98098b9c4b5928f89f338203193c2bf40ab7f38c/CLAUDE.md
[ice-root]: https://github.com/jordanbaird/Ice/tree/11edd39115f3f43a83ae114b5348df6a0e1741cf/Ice
[ice-state]: https://github.com/jordanbaird/Ice/blob/11edd39115f3f43a83ae114b5348df6a0e1741cf/Ice/Main/AppState.swift
[sill-pkg]: https://github.com/Saffsanity/sill/blob/41e8cb8801f8e9d387e27a0d498dee193d17e9ec/Package.swift
[sill-model]: https://github.com/Saffsanity/sill/blob/41e8cb8801f8e9d387e27a0d498dee193d17e9ec/Sources/SillMenuBar/AppModel.swift
[iso-readme]: https://github.com/pointfreeco/isowords/blob/c727d3a7c49cf0c98f2fa4f24c562f81e30165f7/README.md
