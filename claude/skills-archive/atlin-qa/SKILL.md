---
name: atlin-qa
description: QA Atlin (web, iOS, macOS) end to end: screenshots, filters on real Vancouver rentals, parity with the web design. Use for /atlin-qa or "QA atlin".
---

1. `cd ~/Documents/Code/atlin && npm run dev -- --port 5199`. Playwright lives in `~/Documents/Code/vancouvervice/node_modules/playwright` and Chromium is cached, so import it from there.
2. Shoot `/`, `/login`, `/register`, `/browse?preview` at 1440 wide and 390 wide, 2x. `?preview` skips sign-in in dev builds only. Send the shots to Joshua as you go.
3. Drive the selects by `aria-label` (Price, Beds, Type, Sort), the For sale / For rent buttons and the ask bar. Check the count line and the first five cards after each change. Vancouver rent returns about 60 live homes from HousingFeed.
4. Look for: any brown (`#B5836A` family), a second typeface, controls under 44 points, gaps off the 8 point grid, text clipped at 390 wide, console errors.
6. Native: `xcodegen generate`, then `xcodebuild` for iOS Simulator and macOS, screenshot with `xcrun simctl io booted screenshot`. The native look must match the web: one red accent, system font, capsule controls.
7. `npm test` and `npm run build` before every push. CI must be green, issues 0, branches only `main`.
