---
name: appstore-screenshots
description: Set up or run automated App Store screenshot generation for an xcodegen-based iOS app using fastlane snapshot. Use when the user asks to add/update/automate App Store screenshots, or says "run the screenshot shortcut" for an iOS project. Mocks auth/data via launch arguments so no real credentials or live data are needed.
---

# App Store Screenshots (fastlane snapshot)

Generates App Store screenshots for an iOS app without needing real login credentials or live data, by injecting mock state via a launch argument.

## If already set up (has `fastlane/Snapfile` + `UITests/PreviewScreenshot.swift`)

Just run, from the app's `ios/` (or equivalent) directory:

```bash
xcodegen generate
fastlane snapshot
```

This needs `dangerouslyDisableSandbox: true` on the Bash call — xcodebuild's result-bundle writer fails with a `mkstemp` error under the default sandbox.

Screenshots land in `fastlane/screenshots/en-US/<device>-<name>.png`. Copy the ones referenced by the README into wherever the README points (check existing `<img src=...>` tags), `git add -f` them (they're usually `*.png`-gitignored), update the README if filenames changed, then commit + push.

## If setting up from scratch

1. `gem install fastlane --no-document` if not already installed (check `which fastlane` first).
2. `fastlane snapshot init` in the ios project dir — creates `Snapfile` + `SnapshotHelper.swift` at the root; move them to `fastlane/Snapfile` and `UITests/SnapshotHelper.swift`.
3. Add a UI test target in `project.yml` if one doesn't exist (`type: bundle.ui-testing`, `sources: [UITests]`, depends on the app target), and a `schemes:` entry with `shared: true` so fastlane can find it.
4. Find the app's auth/data gate (e.g. an `AppState`/view-model `isAuthenticated` flag, a `bootstrap()` that re-checks session on launch, or per-screen empty-state guards) and add a `CommandLine.arguments.contains("UITEST_SNAPSHOT")` (or per-screen flags like `UITEST_HISTORY`, `UITEST_PAYWALL`) escape hatch in `init()` that sets mock data and **returns early before any real network/session logic runs**. Check both the state object's `init()` and any `bootstrap()`/`onAppear` re-check — both can clobber the mock if not guarded.
5. Write `UITests/PreviewScreenshot.swift`: `@MainActor` test class (Swift 6 strict concurrency requires this on the class, not just the method, or `XCUIApplication` calls won't compile), call `setupSnapshot(app)` before `app.launch()`, append the mock launch argument(s), then call `snapshot("name")` after each `sleep(2-3)` settle. For apps needing several distinct mock states (e.g. recording vs. finished vs. history), launch/terminate a fresh `XCUIApplication` per state within one test rather than one shared instance.
6. Tag any custom (non-native-TabView) navigation buttons with `.accessibilityIdentifier(...)` so the UI test can find them.
7. `xcodegen generate`, then `fastlane snapshot` (sandbox disabled).
8. Verify by reading at least one generated PNG (`Read` tool) before wiring into the README — a build that "passes" can still produce a login screen or blank state if the mock didn't actually take effect.

## Known pitfalls (hit all three building this for Tally)

- Sandbox `mkstemp` error on the xcresult bundle — not a real infra problem, just needs `dangerouslyDisableSandbox: true`.
- Swift 6 actor-isolation compile errors (`call to main actor-isolated ... in a synchronous nonisolated context`) — add `@MainActor` to the test class.
- A `bootstrap()`/session-refresh call running after `init()` can silently overwrite the mocked authenticated state — guard it too, not just `init()`.

## Naming and README

Match screenshot names to whatever the README already references (check `<img src="...">` paths first) rather than inventing a new convention. Keep mock content believable but obviously fake (placeholder amounts/dates), never real personal data.
