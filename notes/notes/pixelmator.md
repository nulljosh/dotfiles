# Pixelmator + Claude Automation -- CONFIRMED

Status: WORKING as of Feb 19 2026

## What works
- Create any canvas size (1080x1080 Instagram, 1920x1080 banner, etc)
- Fill background with any color
- Add text layers (headline, tagline) with position + alignment
- Place logo/image files from disk path, resize, reposition
- Export PNG headlessly -- no UI interaction needed

## Workflow
1. Drop logo in known folder (eg ~/Desktop/logo.png)
2. Tell Claude: biz name, tagline, colors
3. AppleScript runs, Pixelmator generates, PNG exported
4. Claude sends result via iMessage

## Limitations
- Font family styling still flaky (weird API)
- Need .pxd template system for complex layouts

## TODO
- [x] Simplify plan (already concise)
- [ ] Integrate bcgd logo + social media aspect
