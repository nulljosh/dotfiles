---
name: icon-creator
description: Generate a deterministic 1024x1024 app icon (solid color + initials) from an app name, and write it into an Xcode AppIcon.appiconset. Use when an app has no icon or a placeholder icon, or the user asks to make/regenerate an icon from the app's name.
---

# icon-creator

Lazy icon generator: hashes the app name to a color, draws the initials, writes a
valid 1024x1024 no-alpha PNG straight into the target `AppIcon.appiconset/icon-1024.png`.

## Usage

```bash
python3 ~/.claude/skills/icon-creator/make_icon.py "<App Name>" "<path>/AppIcon.appiconset/icon-1024.png"
```

Then verify it's alpha-free and correctly sized (Apple rejects icons with alpha):

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha "<path>/icon-1024.png"
```

Requires the `AppIcon.appiconset/Contents.json` to already reference a single
universal 1024x1024 image (modern Xcode single-size icon format) — most repos
under ~/Documents/Code already use this. If not, create Contents.json:

```json
{"images":[{"filename":"icon-1024.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}
```

After regenerating, rebuild and upload a **new build number** — ASC/TestFlight
caches the icon per-build, so overwriting the PNG alone does nothing until a
fresh build is uploaded (see [[feedback_icon_asc_stale_build]] pattern: diff
build upload date vs icon commit date before assuming a fix didn't work).

skipped: no custom font/logo support, just initials-on-color. add real
branded icons by hand when a name deserves a real mark instead of a placeholder.
