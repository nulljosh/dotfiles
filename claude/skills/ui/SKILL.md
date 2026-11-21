---
name: ui
description: UI pass for SwiftUI apps and their web twins, matched to the OS the app runs on. Liquid Glass on iOS/macOS 26, the right materials on older systems (Ventura, Sonoma, Sequoia, iOS 16 to 18), plus layout, spacing, type and constraint checks. Use for /ui, /liquid-glass, "glass pass", "UI pass", "make it look native", or when a UI uses glass or materials in the wrong places.
---

# /ui

Make every screen look native on the OS it is running on, then tighten layout until it holds up next to Apple's own apps.

## 0. Know the OS first
- `sw_vers -productVersion` on the Mac doing QA, and the app's deployment targets in `project.yml`.
- **iOS/macOS 26+:** Liquid Glass (section 2 below).
- **macOS 11 to 15, iOS 15 to 18 (Ventura is macOS 13):** no glass. Use materials: `.regularMaterial`/`.thinMaterial` (SwiftUI), `NSVisualEffectView` (.headerView, .sidebar, .menu) on AppKit, vibrancy for secondary text. Standard toolbars, sidebars and sheets already look right; don't fake glass with blur stacks.
- Glass code must compile on old toolchains: wrap `glassEffect` and friends in `#if compiler(>=6.2)` plus `if #available(iOS 26, macOS 26, *)`, with the material as the fallback.
- QA on the oldest supported OS too. On Dad's Mac (macOS 13, Xcode 15.2) see memory `reference-xcode15-dads-mac`.

## 1. Layout, every OS
- 8 point grid; side margins 16 (iPhone) to 20+ (Mac/iPad); reading column at most ~680 to 832 pt.
- Hit targets 44 pt on iOS, 28+ pt on macOS; one control height per row.
- Dynamic Type / text size: nothing clips at the largest size; use `@ScaledMetric`, cap where layout would break.
- Constraints: windows have a sensible `defaultSize` and min size on macOS; nothing jumps when content changes; safe areas respected; landscape and iPad split view checked.
- Type: system font, one scale, tabular figures for numbers that change.
- Light, dark, Increase Contrast and Reduce Transparency all checked.
- Every screen follows the window (measure with a background GeometryReader, scale type and columns), not just one view. On macOS 13: no `.newPassword` content type (14+), `SignInWithAppleButton` won't stretch (draw your own capsule, same request), a Picker inside a Menu shows an empty submenu, and a grouped `Form` looks generic; draw settings in the app's own palette.

## Liquid Glass (iOS/macOS 26)

Liquid Glass is a functional layer that floats above content. Get the layer right first; the effect is the easy part.

### Read the source, not memory
Apple's pages render with JavaScript; pull the JSON instead and read it:

```sh
for p in documentation/technologyoverviews/adopting-liquid-glass documentation/swiftui/applying-liquid-glass-to-custom-views design/human-interface-guidelines/materials; do
  curl -s "https://developer.apple.com/tutorials/data/$p.json" -o "$(basename $p).json"; done
```
Extract the text from `primaryContentSections` (paragraphs, headings, code listings). Recheck when a new OS ships.

### The rules (Apple's, 2025 to 2026)
- Glass only in the functional layer: tab bars, toolbars, sidebars, sheets, floating controls, a mini player. Never on content (list rows, chips and search fields that scroll with the list, cards, backgrounds). Content uses standard materials (`.regularMaterial`, `.ultraThinMaterial`) or plain fills.
- Standard components get glass for free (bars, sheets, popovers, menus, toolbars). Remove custom backgrounds from them so the system effect and the scroll edge effect work.
- Use it sparingly, on the most important controls. Never stack glass on glass.
- Regular glass by default. Clear glass only over rich media (photos, artwork, video), with a 35 percent dark dimming layer when the media is bright.
- Tint sparingly, for prominence; colors need light, dark and increased-contrast variants.
- Several custom glass views together go in one `GlassEffectContainer(spacing:)`; morph them with `glassEffectID(_:in:)` and a `@Namespace`; merge shapes with `glassEffectUnion`.
- Apply `glassEffect` after other appearance modifiers. Shapes concentric with their container: `ConcentricRectangle(corners: .concentric(minimum:), isUniform: true)`.
- Buttons: `.buttonStyle(.glass)` and `.glassProminent` instead of hand-made glass. Interactive custom glass: `.regular.interactive()`.
- Toolbars: group related items, `ToolbarSpacer` between groups, icons over text, never text and icons on one background, a label on every icon, hide the item rather than its content.
- Tab bars: `tabBarMinimizeBehavior(.onScrollDown)` for reading apps; `tabViewBottomAccessory` for a mini player; `Tab(role: .search)` for search.
- Bars of your own: `safeAreaBar(edge:)` so content gets the scroll edge effect beneath them.
- Accessibility: Reduce Transparency and Increase Contrast adapt standard glass automatically; test custom glass with both. Section headers in title case.
- Everything new is iOS 26 / macOS 26: wrap it in `if #available` with the old material as the fallback.

## 3. The web twin
Glass in CSS only for the same functional layer: `background: rgba(255,255,255,.26); backdrop-filter: blur(30px) saturate(190%) brightness(1.3)`, a 1 px bright inset top edge and a soft shadow; dark `rgba(28,28,30,.34)`. Older browsers and systems get a plain material blur. Under `@media (prefers-reduced-transparency: reduce)` make it solid (`#f2f2f7`, dark `#1c1c1e`). Content stays flat.

## 4. Passes until right
Each pass: list every glass and material use (`grep -rn "glassEffect\|Material\|backdrop-filter"`), sort each into functional or content layer, fix the misplaced ones, then screenshot light and dark on iPhone, iPad, Mac and the web (show them to Joshua with `~/.local/bin/peek`), and compare with Apple's apps (Music, Podcasts, News). One pass per release; stop when a pass finds nothing. Keep QA silent: never autoplay audio in a simulator.
