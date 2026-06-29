---
name: icon
description: Create or repair an iOS/macOS App Icon so it actually shows up on App Store Connect. Flattens the alpha channel (the #1 reason ASC drops icons), slices all sizes, places them in the Xcode asset catalog, and verifies no 1024 has alpha. Use when an app shows a blank/placeholder icon on App Store Connect or TestFlight, when an icon looks mis-scaled, when adding a macOS icon set, or when the user says "fix the icon" / "/icon".
---

# icon

## The one thing to know

The icon in the App Store Connect Apps list comes from the **latest *processed* build's compiled asset catalog** — NOT the web UI, NOT just editing `AppIcon.appiconset` on disk. Two things make icons disappear:

1. **Alpha channel** on the 1024×1024 marketing icon → Apple silently drops it → blank placeholder. (`sips -g hasAlpha` must say `no`.)
2. **No fresh build** — fixing the asset does nothing on ASC until a new build is uploaded and finishes processing (~5–30 min).

So the fix is always: flatten alpha → rebuild → upload → wait. This skill does the first part and verifies it; shipping is done by the `ship` / `asc-xcode-build` skills.

## Usage

```bash
bash ~/.agents/skills/icon/slice-icon.sh <project-dir> [--source img.png] [--mac] [--check]
```

- `--check` — diagnose only: prints size + `hasAlpha` for every PNG in the icon set(s). Use this first to triage.
- `--source img.png` — master image (≥1024) to use. Omit to reuse the existing 1024, or to generate a gradient+glyph fallback if none exists.
- `--mac` — also create/repair a macOS AppIcon (full 16→1024 size set + Contents.json).

The iOS tinted variant keeps its alpha on purpose (Apple expects it); everything else is flattened onto the icon's own corner colour.

## Workflow

1. **Diagnose:** `slice-icon.sh <dir> --check`
2. **Fix:** `slice-icon.sh <dir>` (add `--mac` if there's a macOS target). It flattens, slices, places, and **aborts if any 1024 still has alpha**.
3. **Wire macOS (xcodegen):** ensure `project.yml` has `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon`, then `xcodegen generate`.
4. **Ship a NEW build:** use the `ship` skill or `asc xcode archive/upload`. The icon will not change on ASC until that build is processed.
5. **Confirm:** after processing, the ASC Apps list shows the icon.

## Notes
- No new dependencies: `magick`/`sips` only. Self-checks alpha on exit.
- Per-app state and the broader fleet fix live in the plan file referenced by the user.
