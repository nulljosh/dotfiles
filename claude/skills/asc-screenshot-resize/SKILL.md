---
name: asc-screenshot-resize
description: Resize and validate App Store screenshots with current asc screenshot-size data and macOS sips. Use when preparing or fixing screenshots for App Store Connect submission.
---

# asc screenshot resize

Prepare screenshots for App Store Connect. No hard-coded dimension table here — the CLI owns the current size matrix.

## Source of truth
```bash
asc screenshots sizes --output table
asc screenshots sizes --all --output table
asc screenshots validate --path "./screenshots/iphone" --device-type "IPHONE_65" --output table
asc screenshots validate --path "./screenshots/ipad" --device-type "IPAD_PRO_3GEN_129" --output table
```
Common anchors: `IPHONE_65` (6.5-inch iPhone set), `IPAD_PRO_3GEN_129` (12.9/13-inch iPad set). Run `--all` for other display types (6.9-inch iPhone, Apple TV, Mac, Vision Pro, iMessage, Watch).

## Workflow

**1. Sanitize filenames** — macOS screenshots can have hidden Unicode spaces that break tools with "not a valid file":
```bash
python3 -c "
import os
for f in os.listdir('.'):
    clean = f.replace(' ', ' ')
    if f != clean:
        os.rename(f, clean)
        print(f'Renamed: {clean}')
"
```

**2. Inspect dimensions/metadata**
```bash
sips -g pixelWidth -g pixelHeight screenshot.png
sips -g hasAlpha -g space screenshot.png
```
ASC rejects alpha transparency — strip it by round-tripping through JPEG:
```bash
sips -s format jpeg input.png --out /tmp/asc-screenshot-no-alpha.jpg
sips -s format png /tmp/asc-screenshot-no-alpha.jpg --out output.png
rm /tmp/asc-screenshot-no-alpha.jpg
```
Batch-strip:
```bash
for f in *.png; do
  if sips -g hasAlpha "$f" | grep -q "yes"; then
    sips -s format jpeg "$f" --out /tmp/asc-screenshot-no-alpha.jpg
    sips -s format png /tmp/asc-screenshot-no-alpha.jpg --out "$f"
    rm /tmp/asc-screenshot-no-alpha.jpg
    echo "Stripped alpha: $f"
  fi
done
```

**3. Resize only after picking a target from `asc screenshots sizes --all`.** `sips -z` takes height first, then width:
```bash
sips -z 2778 1284 input.png --out output.png   # portrait IPHONE_65 1284x2778

mkdir -p resized
for f in *.png; do sips -z 2778 1284 "$f" --out "resized/$f"; done
```

**4. Validate outputs**
```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha resized/*.png
asc screenshots validate --path "./resized" --device-type "IPHONE_65" --output table
```

**5. Upload only after validation**
```bash
asc screenshots upload --version-localization "LOC_ID" --path "./resized" --device-type "IPHONE_65" --dry-run --output table
asc screenshots upload --version-localization "LOC_ID" --path "./resized" --device-type "IPHONE_65"
```

## Guardrails
- Treat `asc screenshots sizes --all` as authoritative — Apple size requirements change.
- Don't stretch across incompatible aspect ratios unless the user accepts the visual tradeoff.
- Always output to a separate file/directory, preserve originals.
- PNG or JPEG only, no alpha transparency.
- Convert Display P3 or other color spaces to sRGB when needed: `sips -m "/System/Library/ColorSync/Profiles/sRGB IEC61966-2.1.icc" input.png --out output.png`
- Prefer `asc screenshots validate` over visual inspection before upload.
