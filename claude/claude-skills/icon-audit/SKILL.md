---
name: icon-audit
description: Audit app icons across all Xcode projects in ~/Documents/Code (1024x1024, alpha, missing PNGs) and explain how to fix ASC icon problems. Use when the user asks about App Store Connect icons, missing/wrong icons, or invokes /icon-audit.
---

# icon-audit

Run `~/.claude/skills/icon-audit/audit.sh` and report the table.

## Interpreting results
- **NO PNG** — iconset empty; ASC will show the grid placeholder. Add a 1024×1024 PNG (or Icon Composer `.icon` file) and upload a new build.
- **has alpha** — iOS App Store rejects alpha in the 1024 marketing icon. Flatten: `sips -s format jpeg in.png --out t.jpg && sips -s format png t.jpg --out in.png` (or re-export without alpha).
- **not 1024x1024** — resize with `sips -z 1024 1024`.

## Things the script can't see (check manually)
- **Full-bleed**: iOS icons must fill the whole 1024 square — no baked-in rounding or padding (Lexly-style bug). Open the PNG and look.
- **Mac shape**: macOS icons need the rounded-rect shape + margins baked in (use Icon Composer / Xcode 26 `.icon`, or apple's template). An iOS full-bleed square on a Mac target looks like the Echo Mac bug.

## Key fact
ASC only shows an icon after a **build containing it is uploaded and processed**. No build = grid placeholder, regardless of assets on disk. Fix icon → bump build → `asc xcode` upload → wait for processing.
