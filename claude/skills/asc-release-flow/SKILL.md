---
name: asc-release-flow
description: Determine whether an app is ready to submit, then drive the current App Store release flow with asc, including validation, staging, review submission, first-time availability, subscriptions, IAP, Game Center, and App Privacy checks.
---

# Release flow (readiness-first)

Use when the question is "Can my app be submitted now?" or when preparing/submitting an App Store version with the current `asc` surface.

## Preconditions
- Resolve `APP_ID`, version string, `VERSION_ID`, and `BUILD_ID` up front.
- Auth via `asc auth login` or `ASC_*` env vars.
- Canonical metadata in `./metadata` for metadata-driven staging.
- Treat `asc web ...` commands as optional experimental escape hatches for flows the public API doesn't cover.

## Answer order
1. Say whether the app is ready right now.
2. Name the blocking issues.
3. Separate public-API fixes from web-session or manual fixes.
4. Give the next exact command to run.

Blockers fall into:
- **API-fixable**: build validity, metadata, screenshots, review details, content rights, encryption, version/build attachment, IAP readiness, Game Center version and review-submission items.
- **Web-session-fixable**: initial app availability bootstrap, first-review subscription attachment, App Privacy publish state.
- **Manual fallback**: first-time IAP selection on the app-version page when no CLI attach flow exists, or when the user won't use experimental web-session commands.

## Canonical current path

### 1. Readiness check
`asc validate` replaces the old submit-preflight shortcut (not in current CLI).

```bash
asc validate --app "APP_ID" --version "1.2.3" --platform IOS --output table
asc validate --app "APP_ID" --version "1.2.3" --platform IOS --strict --output table  # warnings block automation
asc validate iap --app "APP_ID" --output table              # digital goods
asc validate subscriptions --app "APP_ID" --output table
```

### 2. Stage without submitting
`asc release stage` prepares the version, applies/copies metadata, attaches the build, and validates — stops before review submission.

```bash
asc release stage --app "APP_ID" --version "1.2.3" --build "BUILD_ID" \
  --metadata-dir "./metadata/version/1.2.3" --dry-run --output table

asc release stage --app "APP_ID" --version "1.2.3" --build "BUILD_ID" \
  --metadata-dir "./metadata/version/1.2.3" --confirm
```

Use `--copy-metadata-from "1.2.2"` instead of `--metadata-dir` to carry metadata forward from an existing version.

### 3. Submit an already prepared version
`asc review submit` wraps build attachment plus review submission creation.

```bash
asc review submit --app "APP_ID" --version "1.2.3" --build "BUILD_ID" --dry-run --output table
asc review submit --app "APP_ID" --version "1.2.3" --build "BUILD_ID" --confirm
```

Use `--version-id "VERSION_ID"` instead of `--version` once resolved.

### 4. One-command upload and submit
`asc publish appstore` for one high-level upload/build/submit flow. Add `--wait` to wait for build processing before attaching/submitting.

```bash
asc publish appstore --app "APP_ID" --ipa "./App.ipa" --version "1.2.3" --submit --dry-run --output table
asc publish appstore --app "APP_ID" --ipa "./App.ipa" --version "1.2.3" --submit --confirm
```

### 5. Monitor and cancel
```bash
asc status --app "APP_ID"
asc submit status --version-id "VERSION_ID"
asc submit status --id "SUBMISSION_ID"
asc submit cancel --id "SUBMISSION_ID" --confirm
```

## First-time submission blockers

### Initial app availability doesn't exist
Symptoms: `asc pricing availability view --app "APP_ID"` reports no availability; `asc pricing availability edit` can't update because no record exists.

```bash
asc pricing availability view --app "APP_ID"  # check

# Bootstrap (experimental web-session)
asc web apps availability create --app "APP_ID" --territory "USA,GBR" --available-in-new-territories true

# After bootstrap, use the public API for ongoing changes
asc pricing availability edit --app "APP_ID" --territory "USA,GBR" --available true --available-in-new-territories true
```

### Subscriptions ready but not attached to first review
```bash
asc validate subscriptions --app "APP_ID" --output table   # check readiness first
```
If diagnostics report missing metadata, fix prerequisites first — common misses: broad pricing coverage, review screenshots, promotional images, app/build evidence.

```bash
asc web review subscriptions list --app "APP_ID"                                            # list first-review state
asc web review subscriptions attach-group --app "APP_ID" --group-id "GROUP_ID" --confirm    # attach a group
asc web review subscriptions attach --app "APP_ID" --subscription-id "SUB_ID" --confirm     # attach one instead

asc subscriptions review submit --subscription-id "SUB_ID" --confirm  # later reviews: public review path
```

### In-app purchases need review readiness or first-version inclusion
```bash
asc validate iap --app "APP_ID" --output table
asc iap review-screenshots create --iap-id "IAP_ID" --file "./review.png"   # missing review screenshots
asc iap submit --iap-id "IAP_ID" --confirm                                  # IAPs on a published app
```

For the first IAP on an app, or the first time adding a new IAP type, Apple may require selecting the IAP from the app version's "In-App Purchases and Subscriptions" section before submitting. Prepare localization, pricing, and review screenshot data first.

For non-renewing IAPs that must attach to the next app version review, the public API may reject the review item path. Experimental web-session escape hatch (mirrors the ASC web flow, only for this web-only first-version gap — call out that it uses unofficial Apple web-session endpoints):

```bash
asc web review iaps attach --app "APP_ID" --iap-id "IAP_ID" --confirm
```

### Game Center needs app-version and review-submission items
```bash
asc game-center app-versions list --app "APP_ID"
asc game-center app-versions create --app-store-version-id "VERSION_ID"
```

If Game Center component versions must ship with the app version, use the explicit review-submission API so all items get added before submission:

```bash
asc review submissions-create --app "APP_ID" --platform IOS
asc review items-add --submission "SUBMISSION_ID" --item-type appStoreVersions --item-id "VERSION_ID"
asc review items-add --submission "SUBMISSION_ID" --item-type gameCenterLeaderboardVersions --item-id "GC_LEADERBOARD_VERSION_ID"
asc review submissions-submit --id "SUBMISSION_ID" --confirm
```

`asc review items-add` also supports `gameCenterAchievementVersions`, `gameCenterActivityVersions`, `gameCenterChallengeVersions`, `gameCenterLeaderboardSetVersions`.

### App Privacy still unpublished
Public API can surface privacy advisories but can't fully verify App Privacy publish state.

```bash
asc web privacy pull --app "APP_ID" --out "./privacy.json"
asc web privacy plan --app "APP_ID" --file "./privacy.json"
asc web privacy apply --app "APP_ID" --file "./privacy.json"
asc web privacy publish --app "APP_ID" --confirm
```

If avoiding experimental web-session commands, confirm manually: `https://appstoreconnect.apple.com/apps/APP_ID/appPrivacy`

### Review details incomplete
```bash
asc review details-for-version --version-id "VERSION_ID"

asc review details-create --version-id "VERSION_ID" \
  --contact-first-name "Dev" --contact-last-name "Support" \
  --contact-email "dev@example.com" --contact-phone "+1 555 0100" \
  --notes "Explain the reviewer access path here."

asc review details-update --id "DETAIL_ID" --notes "Updated reviewer instructions."
```
Only set demo-account fields when App Review truly needs demo credentials.

## Ready checklist
An app is ready when:
- `asc validate` has no blocking issues.
- `asc release stage --dry-run` produces the expected plan, or `--confirm` has prepared the target version.
- Build is `VALID` and attached to the target version.
- Metadata, screenshots, app info, content rights, encryption, age rating, review details complete.
- App availability exists.
- Digital goods have localization, pricing, review screenshots, and first-review attachments/manual selections handled.
- Game Center app-version and component review items included when needed.
- App Privacy confirmed or published.

Legacy submit-preflight, submit-create, release-run shortcuts are not part of the current CLI — use validate / release stage / review submit / publish appstore / status instead.
