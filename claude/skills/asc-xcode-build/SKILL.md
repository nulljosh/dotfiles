---
name: asc-xcode-build
description: Build, archive, export, upload, and manage Xcode version/build numbers with the current asc xcode helpers before App Store Connect upload or submission. Use when creating an IPA or PKG for upload.
---

# Xcode build and export

Build an app from source and prepare it for App Store Connect. Prefer `asc xcode archive`/`asc xcode export` over raw `xcodebuild` when they fit the project.

## Preconditions
- Xcode + command line tools installed.
- Signing identity/provisioning profiles available, or automatic signing enabled.
- ASC auth configured when upload or build lookup is needed.

## Version and build numbers
```bash
asc xcode version view
asc xcode version edit --version "1.3.0" --build-number "42"
asc xcode version bump --type build
asc xcode version bump --type patch
```
`--project-dir "./MyApp"` when not running from project root, `--project "./MyApp/App.xcodeproj"` for multi-project dirs, `--target "App"` for deterministic reads in multi-target projects.

Avoid low build-number rejects — resolve a remote-safe number first:
```bash
asc builds next-build-number --app "APP_ID" --version "1.2.3" --platform IOS --output json
asc xcode version edit --build-number "NEXT_BUILD"
```

## iOS/tvOS/visionOS build flow

**1. Archive** (`--project "App.xcodeproj"` instead of `--workspace` for project-only apps):
```bash
asc xcode archive --workspace "App.xcworkspace" --scheme "App" --configuration Release --clean \
  --archive-path ".asc/artifacts/App.xcarchive" \
  --xcodebuild-flag=-destination --xcodebuild-flag=generic/platform=iOS --output json
```

**2. Export.** Add `--wait` if `ExportOptions.plist` uses direct ASC upload (polls for build discovery/processing):
```bash
asc xcode export --archive-path ".asc/artifacts/App.xcarchive" --export-options "ExportOptions.plist" \
  --ipa-path ".asc/artifacts/App.ipa" --xcodebuild-flag=-allowProvisioningUpdates --output json

asc xcode export --archive-path ".asc/artifacts/App.xcarchive" --export-options "UploadExportOptions.plist" \
  --ipa-path ".asc/artifacts/App.ipa" --wait --output json
```

**3. Upload or publish**:
```bash
asc builds upload --app "APP_ID" --ipa ".asc/artifacts/App.ipa" --wait
asc publish testflight --app "APP_ID" --ipa ".asc/artifacts/App.ipa" --group "GROUP_ID" --wait
asc publish appstore --app "APP_ID" --ipa ".asc/artifacts/App.ipa" --version "1.2.3" --wait
asc publish appstore --app "APP_ID" --ipa ".asc/artifacts/App.ipa" --version "1.2.3" --wait --submit --confirm
```

## macOS App Store flow

```bash
asc xcode archive --project "MacApp.xcodeproj" --scheme "MacApp" --configuration Release --clean \
  --archive-path ".asc/artifacts/MacApp.xcarchive" \
  --xcodebuild-flag=-destination --xcodebuild-flag=generic/platform=macOS --output json
```

For a `.pkg` export, use raw `xcodebuild -exportArchive` with your `ExportOptions.plist`, then upload:
```bash
xcodebuild -exportArchive -archivePath ".asc/artifacts/MacApp.xcarchive" \
  -exportPath ".asc/artifacts/MacAppExport" -exportOptionsPlist "ExportOptions.plist" -allowProvisioningUpdates

asc builds upload --app "APP_ID" --pkg ".asc/artifacts/MacAppExport/MacApp.pkg" \
  --version "1.0.0" --build-number "123" --wait
```
`.pkg` uploads require `--version` and `--build-number` explicitly — not auto-extracted like IPA metadata.

## Raw xcodebuild fallback
Only when `asc xcode archive/export --help` doesn't cover a project-specific option — try `--xcodebuild-flag` first.
```bash
xcodebuild -showBuildSettings -scheme "App"
```

## Troubleshooting
- **No profiles for bundle ID during export** — add `--xcodebuild-flag=-allowProvisioningUpdates`; verify Apple ID logged into Xcode; verify profiles with `asc-signing-setup`.
- **CFBundleVersion too low** — `asc builds next-build-number --app "APP_ID" --version "1.2.3" --platform IOS`, then `asc xcode version edit --build-number "NEXT_BUILD"`, rebuild, re-upload.
- **Build rejected for missing macOS icon** — needs ICNS icons at all required sizes; fix the asset catalog, rebuild, re-export/upload.

## Notes
- Prefer `asc xcode archive`/`export` for deterministic local artifacts.
- `--overwrite` only when intentionally replacing existing local artifacts.
- `--wait` on upload/publish when the next step depends on processed builds.
- Submission readiness → `asc-submission-health`.
