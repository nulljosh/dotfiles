---
name: liquid-glass
description: Apply Apple's Liquid Glass the way Apple's own docs say, in SwiftUI apps and their web twins, then run passes until it is right. Use for /liquid-glass, "add liquid glass", "glass pass", "make it look like iOS 26", or when a UI uses glass in the wrong places.
---

# /liquid-glass

Liquid Glass is a functional layer that floats above content. Get the layer right first; the effect is the easy part.

## 1. Read the source, not memory
Apple's pages render with JavaScript; pull the JSON instead and read it:

```sh
for p in documentation/technologyoverviews/adopting-liquid-glass documentation/swiftui/applying-liquid-glass-to-custom-views design/human-interface-guidelines/materials; do
  curl -s "https://developer.apple.com/tutorials/data/$p.json" -o "$(basename $p).json"; done
```
Extract the text from `primaryContentSections` (paragraphs, headings, code listings). Recheck when a new OS ships.

## 2. The rules (Apple's, 2025 to 2026)
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
Glass in CSS only for the same functional layer: `background: rgba(255,255,255,.26); backdrop-filter: blur(30px) saturate(190%) brightness(1.3)`, a 1 px bright inset top edge and a soft shadow; dark `rgba(28,28,30,.34)`. Under `@media (prefers-reduced-transparency: reduce)` make it solid (`#f2f2f7`, dark `#1c1c1e`). Content stays flat.

## 4. Passes until right
Each pass: list every glass and material use (`grep -rn "glassEffect\|Material\|backdrop-filter"`), sort each into functional or content layer, fix the misplaced ones, then screenshot light and dark on iPhone, iPad and the web, and compare with Apple's apps (Music, Podcasts, News). One pass per release; stop when a pass finds nothing. Keep QA silent: never autoplay audio in a simulator.
