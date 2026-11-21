---
name: asc-notarization
description: Archive, export, and notarize macOS apps using xcodebuild and asc. Use when you need to prepare a macOS app for distribution outside the App Store with Developer ID signing and Apple notarization.
---

# macOS Notarization

For notarizing a macOS app for distribution outside the App Store.

## Preconditions
- Xcode + command line tools configured.
- Auth configured (`asc auth login` or `ASC_*` env vars).
- A Developer ID Application certificate in the local keychain.
- Xcode project builds for macOS.

## Preflight: verify signing identity

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```
None found → create one at https://developer.apple.com/account/resources/certificates/add (ASC API can't create Developer ID certs).

**Fix broken trust settings** — `codesign`/`xcodebuild` failing with "Invalid trust settings" or "errSecInternalComponent" means the cert has custom trust overrides breaking the chain:
```bash
security dump-trust-settings 2>&1 | grep -A1 "Developer ID"    # check for overrides
security find-certificate -c "Developer ID Application" -p ~/Library/Keychains/login.keychain-db > /tmp/devid-cert.pem
security remove-trusted-cert /tmp/devid-cert.pem
```
Verify the chain after fixing:
```bash
codesign --deep --force --options runtime --sign "Developer ID Application: YOUR NAME (TEAM_ID)" /path/to/any.app 2>&1
```
Must show: Developer ID Application → Developer ID Certification Authority → Apple Root CA.

## 1. Archive
```bash
xcodebuild archive -scheme "YourMacScheme" -configuration Release \
  -archivePath /tmp/YourApp.xcarchive -destination "generic/platform=macOS"
```

## 2. Export with Developer ID

ExportOptions.plist:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key><string>developer-id</string>
    <key>signingStyle</key><string>automatic</string>
    <key>teamID</key><string>YOUR_TEAM_ID</string>
</dict>
</plist>
```
```bash
xcodebuild -exportArchive -archivePath /tmp/YourApp.xcarchive \
  -exportPath /tmp/YourAppExport -exportOptionsPlist ExportOptions.plist
```
Produces a `.app` signed with Developer ID Application plus a secure timestamp. Verify:
```bash
codesign -dvvv "/tmp/YourAppExport/YourApp.app" 2>&1 | grep -E "Authority|Timestamp"
```
Confirm: authority chain starts with "Developer ID Application", timestamp present.

## 3. Zip for notarization
```bash
ditto -c -k --keepParent "/tmp/YourAppExport/YourApp.app" "/tmp/YourAppExport/YourApp.zip"
```

## 4. Submit
```bash
asc notarization submit --file "/tmp/YourAppExport/YourApp.zip"                                    # fire-and-forget
asc notarization submit --file "/tmp/YourAppExport/YourApp.zip" --wait                             # wait for result
asc notarization submit --file "/tmp/YourAppExport/YourApp.zip" --wait --poll-interval 30s --timeout 1h  # custom polling
```

## 5. Check results
```bash
asc notarization status --id "SUBMISSION_ID" --output table
asc notarization log --id "SUBMISSION_ID"                    # developer log for failures
curl -sL "LOG_URL" | python3 -m json.tool                    # detailed issues from the log URL
asc notarization list --output table
asc notarization list --limit 5 --output table
```

## 6. Staple (optional)

After success, staple so the app works offline:
```bash
xcrun stapler staple "/tmp/YourAppExport/YourApp.app"
```
For DMG/PKG, staple after creating the container:
```bash
hdiutil create -volname "YourApp" -srcfolder "/tmp/YourAppExport/YourApp.app" -ov -format UDZO "/tmp/YourApp.dmg"
xcrun stapler staple "/tmp/YourApp.dmg"
```

## Supported formats
| Format | Use Case |
|--------|----------|
| `.zip` | Simplest; zip a signed `.app` bundle |
| `.dmg` | Disk image for drag-and-drop install |
| `.pkg` | Installer package (needs Developer ID Installer cert) |

## PKG notarization
Needs a **Developer ID Installer** certificate (separate from Developer ID Application, not available via ASC API — create at https://developer.apple.com/account/resources/certificates/add).
```bash
productsign --sign "Developer ID Installer: YOUR NAME (TEAM_ID)" unsigned.pkg signed.pkg
asc notarization submit --file signed.pkg --wait
```

## Troubleshooting
- **"Invalid trust settings" during export** — cert has custom trust overrides; see Preflight above.
- **"The binary is not signed with a valid Developer ID certificate"** — signed with Development/App Store cert; re-export with `method: developer-id`.
- **"The signature does not include a secure timestamp"** — add `--timestamp` to manual `codesign` calls, or use `xcodebuild -exportArchive` (adds timestamps automatically).
- **Upload timeout for large files** — `ASC_UPLOAD_TIMEOUT=5m asc notarization submit --file ./LargeApp.zip --wait`
- **"Invalid" result but signing looks correct** — fetch `asc notarization log --id "SUBMISSION_ID"`. Common causes: unsigned nested binaries, missing hardened runtime, embedded libraries without timestamps.

## Notes
- Uses the Apple Notary API v2, not `xcrun notarytool`. Same API key auth as other `asc` commands.
- Files stream directly to Apple's S3 bucket (no full-file buffering); files over 5GB use multipart upload automatically.
- Verify flags with `asc notarization submit --help`.
