---
name: icon
description: Make or fix one app's icon with Icon Composer: a bold flat white glyph on an accent gradient, as a .icon bundle plus flat icon.svg, 1024 PNG with no alpha, and favicons. Use for /icon, "make an icon", "new logo", "icon is blank on App Store Connect", or "redo the icon".
---

# /icon

Icons are always built with Icon Composer bundles (`<Name>.icon`: `icon.json` plus `Assets/glyph.png`), never a hand-flattened PNG alone.

## Make or redo an icon
1. Pick the glyph idea: one concrete object that says what the app does. No text, no letters unless the app is about letters, no emblem, no speech bubble.
2. Pick light and deep hexes for the gradient (one hue; never brown, beige, purple or teal).
3. Write the white SVG glyph on a 1024 grid, inside the central 640 px.
4. Run the generator from the `brand` skill: `make_brand.py <repo> <Name> <light> <deep> <glyph-file> "<idea>"`. It writes the bundle, `icon.svg`, `brand/icon-1024.png` (alpha already removed) and favicons.
5. Read the 1024 PNG. Judge it at small size too (`magick brand/icon-1024.png -resize 29x29 /tmp/s.png` and look). Redraw until it is clean.

## Wire it so App Store Connect shows it
- Add the `.icon` bundle to the Xcode target (xcodegen `sources`), `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` or the bundle name per the target.
- Check alpha: `sips -g hasAlpha brand/icon-1024.png` must say `no`. Repair an existing set with `app-design/references/icon/slice-icon.sh <project-dir> --check` then without `--check`.
- The ASC Apps list only updates from a freshly processed build: ship a new build number.

## Check
Recognisable at 29 px, distinct from the neighbours in `~/Documents/Code/*/icon.svg`, same glyph in every file, no text.
