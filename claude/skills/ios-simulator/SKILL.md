---
name: ios-simulator
description: Drive the iOS Simulator from the CLI to build, launch, and visually verify iOS app changes (echo, brief, nimble, epiphany) without manual Xcode interaction. Use when asked to check, test, or screenshot an iOS app change.
---

# iOS Simulator from the CLI

For verifying SwiftUI changes in echo, brief, nimble, epiphany without opening
Xcode by hand.

## Workflow
1. List available simulators: `xcrun simctl list devices available`
2. Boot one (reuse a booted one if present): `xcrun simctl boot "<device-id>"`
3. Build for simulator:
   `xcodebuild -scheme <Scheme> -destination 'platform=iOS Simulator,name=<device>' build`
4. Install + launch:
   `xcrun simctl install booted <path-to-.app>`
   `xcrun simctl launch booted <bundle-id>`
5. Screenshot to verify: `xcrun simctl io booted screenshot ~/Desktop/sim.png`,
   then Read the PNG to visually confirm the change.

## Notes
- Use the same simulator models as App Store screenshots when visual fidelity
  matters — see [[feedback_appstore_screenshot_resolutions]] (iPhone 11 Pro Max /
  14 Plus), otherwise any available iPhone simulator is fine for a quick check.
- `xcrun simctl launch --console booted <bundle-id>` streams stdout/stderr if you
  need runtime logs instead of just a screenshot.
- Erase simulator state with `xcrun simctl erase <device-id>` only if asked —
  it wipes app data, don't do it to a simulator with in-progress test state.
