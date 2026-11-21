---
name: brand
description: Create or refresh an app's whole brand in one pass: accent colour, Icon Composer icon, flat icon.svg, favicons, brand/tokens.css, brand/BRAND.md design system, README icon. Use for /brand, "make a brand kit", "design system", "logo", or when an app is black and white or has no icon bundle.
---

# /brand

Gives one repo its complete brand from a single command. The generator is
`~/Documents/Code/dotfiles/claude/skills/app-design/references/brand-kit/make_brand.py`; the reference kit is `wordroot/brand` and the proof run is `airwell`.

## Steps
1. **Read the app** (README, CLAUDE.md, landing). Write one line for what it does and one concrete picture for the mark.
2. **Pick the accent.** One hue, a light and a deep hex for the gradient. Never brown, beige, purple or teal. Check the fleet so two neighbours do not share a hue: `grep -h "Accent" ~/Documents/Code/*/brand/BRAND.md`.
3. **Draw the glyph.** Bold flat white SVG on a 1024 grid, no text, no outline, no emblem or bubble, one idea. Stroke glyphs: `stroke="#fff" fill="none" stroke-width="72" stroke-linecap="round"`. Keep it inside the central 640 px so the tile mask never clips it. Save the markup to a temp file.
4. **Run it:** `python3 make_brand.py <repo> <Name> "<light>" "<deep>" <glyph-file> "<idea>"`. It writes `<Name>.icon` (Icon Composer: gradient fills, light and dark, glyph layer), `icon.svg`, `brand/{tokens.css,BRAND.md,mark.svg,icon-1024.png}`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, the favicon links, and the 80 px README icon.
5. **Look at it.** Read `brand/icon-1024.png`. If the glyph is cramped, off-centre or reads as generic, redraw and rerun. A+ means it is recognisable at 29 px.
6. **Wire it.** For Apple targets add `<Name>.icon` to `project.yml` sources and set `ASSETCATALOG_COMPILER_APPICON_NAME`, run `xcodegen generate`, and use the `icon` skill's `slice-icon.sh --check` so the 1024 has no alpha. Point the landing at `tokens.css` and use `var(--accent)` for actions.
7. **Ship.** Commit only the files this wrote, push, deploy the site (a push deploys nothing), and send Joshua the icon image. A new App Store icon needs a new build, so note it in the roadmap.

## Rules
System font only (SF Pro, then Lato, then Helvetica). Space on the 8 point grid, controls 48 points, one radius set. Join the shared design system, do not invent one per app.
