---
name: apple
description: Make a web UI (or SwiftUI view) look and feel like a native Apple app, working as Jony Ive: constraints, an 8 point grid, one set of radii, SF type scale, 48 point capsule controls, inset grouped lists, liquid glass. Use when asked to make something "look like an Apple app", polish a UI, fix spacing, padding and margins, add liquid glass, or invoke /apple.
---

# /apple

Make it look like it shipped from Cupertino. Reductive: take things away until what is left is obviously right. Every value comes from a constraint, never from the eye.

## The loop (until it looks like an Apple app)
1. Screenshot the real page: desktop light, desktop dark, a 390 wide phone. Look at it. Send the screenshots to Joshua as you go (SendUserFile), not at the end.
2. List what is off: misaligned controls, mixed radii, unequal gaps, crowded text, anything decorative.
3. Fix it with the rules below, rebuild, screenshot again. Stop when nothing is off.

## The rules
- **8 point grid.** Gaps are 4, 8, 12, 16, 24, 32, 48 and nothing else. Define them once as CSS variables. Side margin 20, reading column about 680. Pad for `env(safe-area-inset-*)`.
- **Type: the system font.** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`. Never draw or ship a custom face. Scale: 34/41 large title bold, 22/28 title, 17/24 body, 15/20 subhead, 13/18 footnote. Line heights are steps of 4. Tighten large type: -0.022em at 34.
- **Controls are 48 points tall** (44 minimum), capsules, one height for every control in a row. Leading magnifier in search fields, a drawn chevron on pickers (`appearance: none`). Focus is a 4 point ring of the accent at 30 percent, not a thin border.
- **One set of radii:** cards 28, grouped lists 20, controls fully round, icons 22 percent. Never mix.
- **Inset grouped lists:** rounded container, rows padded 12 by 16, a 1 point hairline between rows inset 16 from the start edge, no borders on rows.
- **Liquid glass** for whatever floats over imagery: a translucent tint (about .26 light, .34 dark), `backdrop-filter: blur(30px) saturate(190%) brightness(1.3)`, a 1 point bright top edge (inset shadow), a soft drop shadow. It must stay semi-transparent so the image shows through. A scrim behind the header keeps text readable on any photo. Raise specificity so a later plain `.card` rule cannot flatten it.
- **Color:** one accent for actions and links. Text is near-black on white (#1d1d1f) and near-white on black (#f5f5f7), secondary at 60 percent. Dark mode is true black, grouped surfaces #1c1c1e.
- **Motion:** 0.2 second eases on state, nothing decorative, and honor `prefers-reduced-motion`.
- **Icon:** one bold flat glyph on a soft gradient tile, no text, built with Icon Composer. White glyph, accent gradient.
- **Never:** brown or beige, purple, emoji in UI, borders to separate what spacing can, shadows to fake depth, two sizes where one will do.

## Check before saying done
Controls in a row share a height. Every gap is on the grid. Dark mode and a phone width both look intentional. Text stays readable over a light photo and a dark photo. No console errors. Then commit, push and deploy.

## Where it lives
Joshua's reference implementation is wordroot: `brand/BRAND.md`, `brand/tokens.css` and `web/index.html`.
