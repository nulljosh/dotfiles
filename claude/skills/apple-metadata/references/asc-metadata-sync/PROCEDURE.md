---
name: asc-metadata-sync
description: Sync, validate, and apply App Store metadata with the current asc canonical metadata workflow. Use when updating metadata, localizations, keywords, or migrating legacy fastlane metadata.
---

# asc metadata sync

Keep App Store metadata in sync with App Store Connect. Prefer the canonical `asc metadata` workflow for app-info and version localization fields; use `asc localizations`/`asc migrate` only when the user specifically needs `.strings` files or legacy fastlane metadata.

## Canonical workflow

**1. Pull**
```bash
asc metadata pull --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata"
```
Multiple app-info records → resolve the app-info ID first:
```bash
asc apps info list --app "APP_ID" --output table
asc metadata pull --app "APP_ID" --app-info "APP_INFO_ID" --version "1.2.3" --platform IOS --dir "./metadata"
```

**2. Edit local files**
- `metadata/app-info/<locale>.json` (app-level): `name`, `subtitle`, `privacyPolicyUrl`, `privacyChoicesUrl`, `privacyPolicyText`
- `metadata/version/<version>/<locale>.json` (version): `description`, `keywords`, `marketingUrl`, `promotionalText`, `supportUrl`, `whatsNew`
- Copyright isn't a localization field — `asc versions update --version-id "VERSION_ID" --copyright "2026 Your Company"`

**3. Validate before upload**
```bash
asc metadata validate --dir "./metadata" --output table
asc metadata validate --dir "./metadata" --subscription-app --output table   # subscription apps: extra ToU/EULA heuristic
```

**4. Preview and apply**
```bash
asc metadata push --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata" --dry-run --output table
asc metadata push --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata"
```
`asc metadata apply` is the same operation under the apply-named command shape, same canonical files:
```bash
asc metadata apply --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata" --dry-run
asc metadata apply --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata"
```

## Keyword-only workflow
```bash
asc metadata keywords diff --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata"
asc metadata keywords apply --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata" --confirm

asc metadata keywords import --dir "./metadata" --version "1.2.3" --locale "en-US" --input "./keywords.csv"
asc metadata keywords sync --app "APP_ID" --version "1.2.3" --platform IOS --dir "./metadata" --input "./keywords.csv"
```

## Quick field updates
One-off edits — use `--version-id` when known, or `--version` + `--platform`, never rely on ambiguous latest-version behavior:
```bash
asc apps info edit --app "APP_ID" --version-id "VERSION_ID" --locale "en-US" --whats-new "Bug fixes and improvements"
asc apps info edit --app "APP_ID" --version "1.2.3" --platform IOS --locale "en-US" --description "Your app description here"
asc apps info edit --app "APP_ID" --version "1.2.3" --platform IOS --locale "en-US" --keywords "keyword1,keyword2,keyword3"
asc apps info edit --app "APP_ID" --version "1.2.3" --platform IOS --locale "en-US" --support-url "https://support.example.com"
```
App-info fields → prefer the post-create setup command:
```bash
asc app-setup info set --app "APP_ID" --primary-locale "en-US" --privacy-policy-url "https://example.com/privacy"
asc app-setup info set --app "APP_ID" --locale "en-US" --name "Your App Name" --subtitle "Your subtitle"
```

## Lower-level localization files
Use `.strings` files only when the user specifically wants import/export files instead of canonical JSON:
```bash
asc localizations list --version "VERSION_ID" --output table
asc localizations download --version "VERSION_ID" --path "./localizations"
asc localizations upload --version "VERSION_ID" --path "./localizations" --dry-run
asc localizations upload --version "VERSION_ID" --path "./localizations"
```
App-info localizations:
```bash
asc apps info list --app "APP_ID" --output table
asc localizations list --app "APP_ID" --type app-info --app-info "APP_INFO_ID" --output table
asc localizations download --app "APP_ID" --type app-info --app-info "APP_INFO_ID" --path "./app-info-localizations"
asc localizations upload --app "APP_ID" --type app-info --app-info "APP_INFO_ID" --path "./app-info-localizations" --dry-run
asc localizations upload --app "APP_ID" --type app-info --app-info "APP_INFO_ID" --path "./app-info-localizations"
```

## Legacy fastlane metadata
Only for existing fastlane-format trees:
```bash
asc migrate export --app "APP_ID" --version-id "VERSION_ID" --output-dir "./fastlane"
asc migrate validate --fastlane-dir "./fastlane"
asc migrate import --app "APP_ID" --version-id "VERSION_ID" --fastlane-dir "./fastlane" --dry-run
asc migrate import --app "APP_ID" --version-id "VERSION_ID" --fastlane-dir "./fastlane"
```

## Character limits
| Field | Limit |
|-------|-------|
| Name | 30 |
| Subtitle | 30 |
| Keywords | 100 comma-separated characters |
| Description | 4000 |
| What's New | 4000 |
| Promotional Text | 170 |

## Agent behavior
- Start with `asc metadata pull` unless the user specifically wants `.strings` or fastlane metadata.
- Always `asc metadata validate` before remote writes; preview with `--dry-run` where supported.
- Quick edits always pass `--version-id` or `--version`+`--platform` — never rely on ambiguous latest-version behavior.
- Keep app-info fields and version fields separate.
- `--output table` for human verification, JSON for automation.
