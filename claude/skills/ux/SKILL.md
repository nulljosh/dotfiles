---
name: ux
description: Make a SwiftUI app easy to use and accessible - Dynamic Type, VoiceOver, contrast, Reduce Motion, touch targets, first-run and empty states - then verify it builds. Use for /ux, "make it accessible", "a11y pass", "make it intuitive", "Dynamic Type", "VoiceOver", or working through the app list in notes/notes/ios-ux-guide.md.
---

# /ux

The full rules, audit table and app order live in `~/Documents/Code/notes/notes/ios-ux-guide.md`. Read it first and tick the app off there when it's done.

## 1. Audit the app
```bash
g(){ grep -rhoE "$1" . --include='*.swift' | wc -l | tr -d ' '; }
echo fixed=$(g 'font\(\.system\(size') labels=$(g 'accessibilityLabel') motion=$(g 'reduceMotion') hex=$(g 'Color\(red|Color\(hex')
```
zsh: quote `--include='*.swift'`, and don't pass a file list as `$files` (it won't split). Use Python for bulk edits.

## 2. Fix, in this order
1. **Dynamic Type.** Literal `.system(size: N, weight: W)` becomes `.system(.style, weight: W)`: 10-11 caption2, 12 caption, 13 footnote, 14-15 subheadline, 16 callout, 17 body, 20 title3, 22 title2, 28 title, 30-34 largeTitle. Bigger hero text uses `@ScaledMetric(relativeTo: .largeTitle)`. Leave sizes computed from a container (fit-to-width amounts, avatar initials).
2. **VoiceOver.** Every icon-only button gets `.accessibilityLabel`. Rows become `.accessibilityElement(children: .combine)`. Decorative images get `.accessibilityHidden(true)`. Charts get `.accessibilityChartDescriptor` or a summary label.
3. **Reduce Motion.** Long, looping or zooming animations check `@Environment(\.accessibilityReduceMotion)` and fall back to a fade.
4. **Contrast and colour.** No raw hex in views, use asset colours with dark and high-contrast variants. Never colour alone, pair it with an icon or text.
5. **Targets.** 44x44pt minimum. Every gesture has a button alternative.
6. **First run.** No welcome screen means run `/onboarding`. Empty lists get `ContentUnavailableView` with one action. Destructive actions get undo or a confirm.

## 3. Verify
`xcodegen` then `xcodebuild -scheme <App> -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO`, and grep for `BUILD SUCCEEDED` (don't use `-quiet`, it hides the result). Rerun the audit and paste before and after numbers. Say what you did not check on screen, such as AX5 layouts and VoiceOver walks.

Deeper single-topic audits: `xcode-integration:accessibility-dynamic-type-specialist`, `-voiceover-specialist`, `-sufficient-contrast-specialist`. Visual polish: `/ui`, `/apple`.
