---
name: xcodebuildmcp
description: Build, run, debug, and UI-test iOS/macOS apps (echo, brief, nimble, epiphany) via the XcodeBuildMCP server instead of raw xcodebuild/simctl. Use when asked to build, run, fix a build error, or drive the simulator for one of these apps.
---

# XcodeBuildMCP

MCP server (`claude mcp list` → `XcodeBuildMCP`) giving direct tool access to
Xcode build/run/debug/simulator-UI-automation, so builds can be fixed and
re-run in a loop without shelling out to `xcodebuild`/`simctl` by hand.

## When to use this vs other tools
- **Build, run, fix errors, tap/swipe through the app, read device logs** →
  use XcodeBuildMCP tools (`mcp__XcodeBuildMCP__*`) directly.
- **Generate final App Store screenshots** (specific device sizes, multiple
  locales) → still use the `appstore-screenshots` skill (fastlane snapshot).
  XcodeBuildMCP is for the dev loop, not App Store asset pipelines.
- Quick one-off screenshot with no MCP tools loaded → the `ios-simulator`
  skill's raw `xcrun simctl` workflow still works as a fallback.

## Workflow
1. `ToolSearch` for `mcp__XcodeBuildMCP__` to load the tool schemas (they're
   deferred until searched).
2. Discover the project's scheme/destination if unknown (list schemes tool,
   or check the `.xcodeproj`/`.xcworkspace` in the repo).
3. Build for simulator, install, and launch via the MCP tools rather than
   raw `xcodebuild`/`simctl install`/`launch`.
4. Use the screenshot/tap/swipe tools to visually verify the change instead
   of manually opening Simulator.app.
5. On build failure, read the error from the tool result and fix the source
   file directly, then rebuild — don't drop back to manual `xcodebuild` calls
   mid-loop.

## Notes
- Installed user-scoped: `claude mcp add XcodeBuildMCP -s user -- npx -y xcodebuildmcp@latest mcp`.
- No project-level `.xcodebuildmcp/config.yaml` is required to start; only
  add one if a project's scheme/destination needs to be pinned.
