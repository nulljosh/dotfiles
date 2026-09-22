---
name: swiftui-design
description: Anti-slop rules for SwiftUI frontend design — spacing, hierarchy, native idioms, avoiding generic AI-generated layouts. Use when building or reviewing SwiftUI views for echo, brief, nimble, or epiphany's iOS app.
---

# SwiftUI design (anti-slop)

Apply to any `.swift` view file across echo, brief, nimble, epiphany.

## Avoid generic AI slop
- No centered VStacks of icon + title + subtitle as the default for every screen —
  vary layout to the content (lists, grids, forms where appropriate).
- Don't add gradient backgrounds, glassmorphism, or shadow-everything unless the
  rest of the app already uses that language. Match existing screens first.
- Use system colors (`.primary`, `.secondary`, semantic colors) over hardcoded hex
  unless matching a specific brand palette already in the app.

## Hierarchy and spacing
- One dominant element per screen; secondary info should visually recede
  (`.secondary` foreground, smaller font, less weight).
- Prefer system spacing constants/`Spacing` tokens already defined in the project
  over magic numbers like `.padding(17)`.
- Respect safe area and Dynamic Type — test with larger text sizes, don't fix
  layout with hardcoded frame heights that clip at larger sizes.

## Native idioms
- Use native components (`List`, `Form`, `NavigationStack`, `.searchable`) instead
  of rebuilding them with VStack/ScrollView — they're cheaper to maintain and
  inherit accessibility, swipe actions, and platform conventions for free.
- Sheet vs push: settings/forms/one-off actions → sheet; drill-down navigation →
  push (`NavigationLink`).

## Compiler performance
See [[feedback_swiftui_compiler]] — extract complex closures and stacked
modifiers into separate methods/computed properties to avoid type-checker
timeouts, especially in ViewBuilder-heavy bodies.
