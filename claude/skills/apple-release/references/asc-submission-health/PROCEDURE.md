---
name: asc-submission-health
description: Validate App Store submission readiness, submit prepared versions, and monitor review status with current asc commands. Use when shipping or troubleshooting review submissions.
---

# asc submission health

Reduce review submission failures and monitor review state. Current readiness command is `asc validate` — legacy submit-preflight/submit-create shortcuts are removed, don't use them.

## Preconditions
- Auth configured, app/version/build IDs resolved.
- Build processing complete, or use a high-level flow with `--wait`.
- Metadata, app info, screenshots, review details, content rights, encryption, pricing, availability expected complete.

## Pre-submission checklist

**1. Build status** — `asc builds info --build-id "BUILD_ID"`. Check `processingState` is `VALID` and encryption fields are understood.

**2. Readiness validation**
```bash
asc validate --app "APP_ID" --version "1.2.3" --platform IOS --output table
asc validate --app "APP_ID" --version "1.2.3" --platform IOS --strict --output table   # warnings fail automation
asc validate --app "APP_ID" --version-id "VERSION_ID" --platform IOS --output table    # if version ID already known
```

**3. Encryption compliance** (non-exempt encryption)
```bash
asc encryption declarations list --app "APP_ID"
asc encryption declarations create --app "APP_ID" --app-description "Uses standard HTTPS/TLS" \
  --contains-proprietary-cryptography=false --contains-third-party-cryptography=true --available-on-french-store=true
asc encryption declarations assign-builds --id "DECLARATION_ID" --build "BUILD_ID"
```
Only exempt transport encryption: update the local plist and rebuild instead — `asc encryption declarations exempt-declare --plist "./Info.plist"`.

**4. Content rights** — `asc apps content-rights view --app "APP_ID"` / `asc apps content-rights edit --app "APP_ID" --uses-third-party-content=false`

**5. Version metadata and localizations**
```bash
asc versions view --version-id "VERSION_ID" --include-build --include-submission
asc localizations list --version "VERSION_ID" --output table
```
Canonical metadata repair:
```bash
asc metadata pull --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata"
asc metadata validate --dir "./metadata" --output table
asc metadata push --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata" --dry-run --output table
asc metadata push --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata"
```

**6. App info localizations and privacy policy**
```bash
asc apps info list --app "APP_ID" --output table
asc localizations list --app "APP_ID" --type app-info --app-info "APP_INFO_ID" --output table
```
Subscription/IAP apps need a privacy policy URL: `asc app-setup info set --app "APP_ID" --primary-locale "en-US" --privacy-policy-url "https://example.com/privacy"`

**7. Screenshots**
```bash
asc screenshots list --version-localization "LOC_ID" --output table
asc screenshots sizes --output table
asc screenshots validate --path "./screenshots" --device-type "IPHONE_65" --output table
```

**8. Digital goods readiness**
```bash
asc validate iap --app "APP_ID" --output table
asc validate subscriptions --app "APP_ID" --output table
asc validate subscriptions --app "APP_ID" --output json --pretty   # exact diagnostics
```

**9. App Privacy advisory** — public API can't fully verify publish state. If validation reports an advisory, use experimental web-session flow or confirm manually:
```bash
asc web privacy pull --app "APP_ID" --out "./privacy.json"
asc web privacy plan --app "APP_ID" --file "./privacy.json"
asc web privacy apply --app "APP_ID" --file "./privacy.json"
asc web privacy publish --app "APP_ID" --confirm
```
Manual fallback: `https://appstoreconnect.apple.com/apps/APP_ID/appPrivacy`

## Submit

**Prepared version** (`asc review submit` wraps build attachment + submission; use `--version-id` once resolved):
```bash
asc review submit --app "APP_ID" --version "1.2.3" --build "BUILD_ID" --dry-run --output table
asc review submit --app "APP_ID" --version "1.2.3" --build "BUILD_ID" --confirm
```

**Upload and submit in one flow** (add `--wait` to wait for build processing):
```bash
asc publish appstore --app "APP_ID" --ipa "./App.ipa" --version "1.2.3" --submit --dry-run --output table
asc publish appstore --app "APP_ID" --ipa "./App.ipa" --version "1.2.3" --submit --confirm
```

**Multi-item review submissions** — use the lower-level API when items beyond the version are needed (e.g. Game Center component versions):
```bash
asc review submissions-create --app "APP_ID" --platform IOS
asc review items-add --submission "SUBMISSION_ID" --item-type appStoreVersions --item-id "VERSION_ID"
asc review items-add --submission "SUBMISSION_ID" --item-type gameCenterChallengeVersions --item-id "GC_CHALLENGE_VERSION_ID"
asc review submissions-submit --id "SUBMISSION_ID" --confirm
```

Non-renewing IAPs Apple requires selecting with the next app version: public API can reject both direct review items and standalone IAP submission. After validating IAP readiness, use the experimental web-session attachment only for this gap (unofficial endpoints — document it in the handoff):
```bash
asc web review iaps attach --app "APP_ID" --iap-id "IAP_ID" --confirm
```

## Monitor
```bash
asc status --app "APP_ID"
asc submit status --id "SUBMISSION_ID"
asc submit status --version-id "VERSION_ID"
asc review submissions-list --app "APP_ID" --paginate
```

## Cancel and retry
```bash
asc submit cancel --id "SUBMISSION_ID" --confirm
asc submit cancel --version-id "VERSION_ID" --app "APP_ID" --confirm
asc review submissions-cancel --id "SUBMISSION_ID" --confirm
```
Fix validation issues, then resubmit with `asc review submit` or `asc publish appstore --submit --confirm`.

## Common submission errors
- **Version not in valid state** — check: build attached and `VALID`; encryption declaration resolved/exempt; content rights set; required localizations and screenshots present; review details present; pricing and availability exist; App Privacy reviewed and published.
- **Export compliance must be approved** — upload export compliance documentation, or rebuild with exempt encryption metadata if accurate.
- **Multiple app infos found** — use the exact app-info ID from `asc apps info list --app "APP_ID" --output table`.

## Notes
- Legacy submit-preflight/submit-create shortcuts are removed — use `asc validate`, `asc review submit`, `asc publish appstore --submit --confirm`.
- App Privacy publish state isn't fully verifiable through the public API.
- `--output table` for human status, JSON for automation.
- macOS submissions follow the same flow with `--platform MAC_OS`.
