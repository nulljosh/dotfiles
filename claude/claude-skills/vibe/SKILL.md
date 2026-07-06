---
name: vibe
description: Extract design tokens (colors, typography, spacing, effects) from a URL and generate a portfolio vibe reference file
model: haiku
---

# Vibe: Design Token Extractor

Extract design aesthetic (colors, typography, effects) from a reference URL and generate a design-tokens.css comment reference for the current project.

## Usage

```bash
/vibe <url>              # Extract tokens from URL, generate design-tokens.css in current project
/vibe <url> --format json  # Output as JSON instead of CSS comments
```

## What it does

1. Launches a headless browser via puppeteer
2. Loads the URL and samples computed styles from:
   - Background/text colors
   - Heading styles  
   - Links, borders, typography
   - Font imports, border-radius, box-shadows
3. Generates a design-tokens.css file (CSS custom properties + comment documentation)
4. Stores the file in the current project root for reference

## Example

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Documents/Code/apps/cadence
/vibe https://heyitsmejosh.com
# → generates portfolio-tokens.css with design palette reference
```

The generated file is for reference—manually apply colors/fonts/spacing to your project's own CSS.

## Fonts (don't skip this — repeatedly missed in past runs)

Extracting `fontFamily`/`headingFontFamily` strings is not enough. The font switch isn't done until the actual files exist and are wired in:

- **Web project**: add the `@font-face`/Google Fonts `<link>` or `@import` so the family actually loads — don't just reference the name in CSS.
- **Native project (iOS/Android/etc.)**: there is no CDN auto-load. You must:
  1. Download the real font files (e.g. from `https://github.com/google/fonts`, `ofl/<family>/` — check for a `static/` dir first; fall back to the variable font if no static instances exist).
  2. Place them in the project's font/resources directory.
  3. Register them (iOS: `UIAppFonts` array in `Info.plist`; Android: equivalent resource registration).
  4. Update the actual view/component code to reference the font by its real PostScript/family name (inspect with `fonttools`: `TTFont(path)['name'].getDebugName(6)` for PostScript name, `getDebugName(16)` for family) — don't guess the name.
- After wiring, build and visually verify (screenshot) — a wrong font name fails silently at runtime, not at build time.

## Implementation

Uses the vibe tool from ~/Documents/Code/dotfiles/vibe/index.js (puppeteer + computed styles sampling).

## Troubleshooting

- **Browser error**: Run `npx puppeteer browsers install chrome` in ~/Documents/Code/dotfiles/vibe/
- **Network timeout**: Some URLs may take 30+ seconds; be patient
- **No output**: Check that the URL is accessible and has styled elements
