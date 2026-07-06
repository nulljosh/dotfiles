---
name: asc-name-creator
description: Brainstorm and verify App Store app name candidates, checking real-time availability against Apple's exact-match namespace using asc. Use when an app name is taken, when naming/renaming an app for the App Store, or when asked to find an available app name.
---

# ASC Name Creator

App name availability on the App Store is exact-match, per-account, and *not* fully reflected in search results — a name can look free in `asc apps public search` and still get rejected as a duplicate. The only reliable check is attempting the write and reading the response.

## Preconditions

- `asc auth token --confirm` works (auth configured).
- You have the target app's ASC id and its `appInfoLocalizations` id (see below).

## Workflow

### 1. Get the appInfoLocalizations id (once per app)

```bash
TOKEN=$(asc auth token --confirm)
INFO_ID=$(curl -s "https://api.appstoreconnect.apple.com/v1/apps/<APP_ID>/appInfos" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'][0]['id'])")
curl -s "https://api.appstoreconnect.apple.com/v1/appInfos/$INFO_ID/appInfoLocalizations" \
  -H "Authorization: Bearer $TOKEN"
# take the en-US localization's "id" — this is what you PATCH
```

### 2. Brainstorm 8-10 candidates

Short, brandable, on-theme with the product. Prefer one word or a tight two-word phrase over a generic "X: Subtitle" pattern (subtitles read as more genuic/AI-named and collide more). Vary root words, not just suffixes, so a rejection doesn't kill the whole batch (e.g. don't just try Spark/Sparkly/Sparker — mix in unrelated roots too).

### 3. Pre-filter with search (cheap, not authoritative)

```bash
asc apps public search --term "<candidate>" --country us
```

Skip candidates with an exact-name hit in results. This does NOT guarantee availability — different accounts can still collide invisibly (confirmed: "Sparkboard" had no search hit but was still rejected as duplicate).

### 4. Confirm by attempting the write

```bash
curl -s -X PATCH "https://api.appstoreconnect.apple.com/v1/appInfoLocalizations/<LOCALIZATION_ID>" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"data\":{\"type\":\"appInfoLocalizations\",\"id\":\"<LOCALIZATION_ID>\",\"attributes\":{\"name\":\"<candidate>\"}}}"
```

- Success: response has `"data"` with the new name — the name is now live, done.
- Taken: response has `"errors"` with code `ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE.DIFFERENT_ACCOUNT` — try the next candidate.

Loop through candidates until one succeeds. Since a successful PATCH is live immediately, only run this on names the user actually wants applied — don't PATCH-test names you'd reject on taste grounds.

### 5. Report

Tell the user the final live name, plus which candidates were tried and rejected (useful context if they want to dispute a trademark-eligible name later via Apple's name release process).

## Notes

- This same `appInfoLocalizations.name` PATCH is the only way to rename an app in ASC — there is no `asc apps update --name` flag as of this writing.
- For brand-new apps (not yet created in ASC), use `asc-app-create-ui` instead — creation is a different flow, but the same taken-name rejection applies at creation time.
