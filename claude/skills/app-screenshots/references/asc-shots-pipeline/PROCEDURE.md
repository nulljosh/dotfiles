---
name: asc-shots-pipeline
description: Orchestrate iOS screenshot automation with xcodebuild/simctl for build-run, AXe for UI actions, JSON settings and plan files, Koubou-based framing (`asc screenshots frame`), and screenshot upload (`asc screenshots upload`). Use when users ask for automated screenshot capture, AXe-driven simulator flows, frame composition, or screenshot-to-upload pipelines.
---

# asc screenshots pipeline (xcodebuild -> AXe -> frame -> asc)

Agent-driven screenshot workflow: build/launch with Xcode CLI tools, drive UI with AXe, upload with `asc`.

## Current scope
- Implemented: build/run, AXe plan capture, frame composition, upload. Device discovery via `asc screenshots list-frame-devices`.
- Local screenshot automation commands are experimental in asc cli.
- Framing pinned to Koubou `0.18.1` for deterministic output.
- Issues: https://github.com/rorkai/App-Store-Connect-CLI/issues/new/choose

## Defaults
- Settings: `.asc/shots.settings.json` · Plan: `.asc/screenshots.json`
- Raw: `./screenshots/raw` · Framed: `./screenshots/framed` · Default frame device: `iphone-air`

## 1) Settings JSON

```json
{
  "version": 1,
  "app": { "bundle_id": "com.example.app", "project": "MyApp.xcodeproj", "scheme": "MyApp", "simulator_udid": "booted" },
  "paths": { "plan": ".asc/screenshots.json", "raw_dir": "./screenshots/raw", "framed_dir": "./screenshots/framed" },
  "pipeline": { "frame_enabled": true, "upload_enabled": false },
  "upload": { "version_localization_id": "", "device_type": "IPHONE_65", "source_dir": "./screenshots/framed" }
}
```

Skipping framing: set `"frame_enabled": false` and `"upload.source_dir": "./screenshots/raw"`.

## 2) Build and run on simulator

```bash
xcrun simctl boot "$UDID" || true
xcodebuild -project "MyApp.xcodeproj" -scheme "MyApp" -configuration Debug \
  -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath ".build/DerivedData" build
xcrun simctl install "$UDID" ".build/DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app"
xcrun simctl launch "$UDID" "com.example.app"
```

Use `xcodebuild -showBuildSettings` if the app bundle path differs.

## 3) Capture with AXe / `asc screenshots run`

Plan-driven capture:

```bash
asc screenshots run --plan ".asc/screenshots.json" --udid "$UDID" --output json
```

AXe primitives for authoring a plan:

```bash
axe describe-ui --udid "$UDID"
axe tap --id "search_field" --udid "$UDID"
axe type "wwdc" --udid "$UDID"
axe screenshot --output "./screenshots/raw/home.png" --udid "$UDID"
```

Minimal `.asc/screenshots.json`:

```json
{
  "version": 1,
  "app": { "bundle_id": "com.example.app", "udid": "booted", "output_dir": "./screenshots/raw" },
  "steps": [{ "action": "launch" }, { "action": "wait", "duration_ms": 800 }, { "action": "screenshot", "name": "home" }]
}
```

## 4) Frame with `asc screenshots frame`

```bash
pip install koubou==0.18.1
kou --version  # expect 0.18.1
kou setup-frames  # only if Koubou reports missing device frames (needs network)

asc screenshots list-frame-devices --output json  # list supported --device values first

asc screenshots frame --input "./screenshots/raw/home.png" --output-dir "./screenshots/framed" \
  --device "iphone-air" --output json
```

`--device` values: `iphone-air` (default), `iphone-17-pro`, `iphone-17-pro-max`, `iphone-16e`, `iphone-17`, `mac`.

## 5) Upload with asc

Review before upload:

```bash
asc screenshots review-generate --framed-dir "./screenshots/framed" --output-dir "./screenshots/review"
asc screenshots review-open --output-dir "./screenshots/review"
asc screenshots review-approve --all-ready --output-dir "./screenshots/review"
```

For reviewed multi-locale sets, use plan/apply so existing remote screenshot counts are respected:

```bash
asc screenshots plan --app "APP_ID" --version "1.2.3" --review-output-dir "./screenshots/review" --output json
asc screenshots apply --app "APP_ID" --version "1.2.3" --review-output-dir "./screenshots/review" --confirm --output json
```

Direct upload (default source `./screenshots/framed`):

```bash
asc screenshots upload --version-localization "LOC_ID" --path "./screenshots/framed" --device-type "IPHONE_65" --output json
```

Check first: `asc screenshots sizes --output table`, `asc screenshots list --version-localization "LOC_ID" --output table`.

## Agent behavior
- Confirm exact flags with `--help` before running — screenshot commands evolve quickly.
- Default to JSON output for machine steps; use explicit long flags.
- Prefer `asc screenshots list-frame-devices` before picking a frame device.
- Verify screenshot files exist before upload.
- Call local screenshot automation "experimental" in handoff notes.
- Use `plan`/`apply` for reviewed batches needing append-limit guardrails.
- Framing version error → reinstall pinned Koubou. Missing device frames → `kou setup-frames` once with network.

## 6) Multi-locale capture

Don't use `xcrun simctl launch ... -e AppleLanguages` — that's an env var pattern and doesn't reliably switch app language. Instead set simulator-wide locale defaults per UDID, one simulator per locale (create once with `xcrun simctl create`), then let `asc screenshots capture` relaunch internally:

```bash
capture_locale() {
  local LOCALE="$1" UDID="$2"
  local LANG="${LOCALE%%-*}" APPLE_LOCALE="${LOCALE/-/_}"
  xcrun simctl boot "$UDID" || true
  xcrun simctl spawn "$UDID" defaults write NSGlobalDomain AppleLanguages -array "$LANG"
  xcrun simctl spawn "$UDID" defaults write NSGlobalDomain AppleLocale -string "$APPLE_LOCALE"
  xcrun simctl terminate "$UDID" "com.example.app" || true
  asc screenshots capture --bundle-id "com.example.app" --name "home" --udid "$UDID" \
    --output-dir "./screenshots/raw/$LOCALE" --output json
}

declare -A LOCALE_UDID=(["en-US"]="UDID_EN_US" ["de-DE"]="UDID_DE_DE" ["fr-FR"]="UDID_FR_FR" ["ja-JP"]="UDID_JA_JP")

# Sequential:
for LOCALE in "${!LOCALE_UDID[@]}"; do capture_locale "$LOCALE" "${LOCALE_UDID[$LOCALE]}"; done

# Parallel (one simulator per locale, run concurrently):
for LOCALE in "${!LOCALE_UDID[@]}"; do capture_locale "$LOCALE" "${LOCALE_UDID[$LOCALE]}" & done; wait
```

Manual launch (outside `asc screenshots capture`) needs explicit launch args: `xcrun simctl launch "$UDID" "com.example.app" -AppleLanguages "(de)" -AppleLocale "de_DE"`.

Full pipeline (parallel capture → parallel frame → one review pass → per-locale upload):

```bash
DEVICE="iphone-air"; RAW_DIR="./screenshots/raw"; FRAMED_DIR="./screenshots/framed"

for LOCALE in "${!LOCALE_UDID[@]}"; do capture_locale "$LOCALE" "${LOCALE_UDID[$LOCALE]}" & done; wait

for LOCALE in "${!LOCALE_UDID[@]}"; do
  ( asc screenshots frame --input "$RAW_DIR/$LOCALE/home.png" --output-dir "$FRAMED_DIR/$LOCALE" --device "$DEVICE" --output json ) &
done; wait

asc screenshots review-generate --framed-dir "$FRAMED_DIR" --output-dir "./screenshots/review"

for LOCALE in "${!LOCALE_UDID[@]}"; do
  asc screenshots upload --version-localization "LOC_ID_FOR_$LOCALE" --path "$FRAMED_DIR/$LOCALE" --device-type "IPHONE_65" --output json
done
```
