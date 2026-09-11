---
name: platform-parity-check
description: For an app with web + iOS/macOS/watchOS (and/or KMP) targets, check that a data/content file (protocols, entries, catalog, etc.) is in sync across every platform, patch the platforms that lag, then check App Store Connect for any rejection blocking that app's ship and act on it (file a precedent-backed appeal, or report the real blocker). Use when the user adds content to one platform and asks "is this everywhere", "make sure all platforms have this", "why isn't this app approved", or invokes /platform-parity-check.
---

# Platform parity + rejection check

Two things that come up together on this codebase: content added to one platform's data file silently drifts from its siblings, and apps sit rejected in ASC for reasons nobody re-checked in weeks.

## 1. Find the most-built platform

For the named app, locate every copy of the relevant data file — typically `src/data/*.js` (web), `ios/Models/*.swift`, `macos/Models/*.swift`, `ios/watchos/Models/*.swift`, `kmp/**/*.kt`. Count entries in each (grep the record-opening pattern, e.g. `id: '` or `.init(id:`, not just line count — struct field declarations also match `id:` and inflate the count). The file with the most entries is the source of truth for what's missing elsewhere.

## 2. Diff and patch

List entry IDs per platform (not just counts) to find exact gaps — two platforms can have the same count but different content. Where a native file's existing entries are otherwise byte-identical prose to a sibling platform (common with iOS/macOS/watchOS sharing one Swift model shape), patch all lagging platforms with one script pass rather than hand-editing each — insert before a stable anchor entry, verify the insert landed with a real content grep (an "id: overbite" match can be a false positive from unrelated body text mentioning the word — check for the record-opening pattern specifically).

Report platform entry counts before/after in one line each. Don't touch KMP/watchOS files that don't carry the same data (verify with `ls`/`grep` before assuming parity is expected there).

## 3. Check ASC rejection status

```
asc apps list | jq matching app name → app ID
asc versions list --app APP_ID   # appStoreState per platform
```

If `REJECTED`, get the actual reason:
```
asc web review show --app APP_ID --output markdown
```
This needs a live web session (`asc web auth status`). If it's expired:
- Try `asc-login` (reads Keychain creds, only prompts for 2FA — safe to run blind, ask the user for the 6-digit code from their trusted device).
- If that 404s on "failed to get auth service key" even after `brew upgrade asc` — known flaky endpoint, see `reference_asc_web_login_404_fallback` memory. Fall back to driving `appstoreconnect.apple.com` directly via Claude in Chrome: Distribution → the rejected platform → "View Submission" → read the Apple message, same info the CLI would have shown.

Check **every platform separately** (iOS and macOS are different submissions with independently-set rejection reasons) — don't assume one platform's reason applies to the other, even on the same version number.

## 4. Act on the reason

- **4.3(a) Design: Spam boilerplate** ("shares a similar binary, metadata, and/or concept... only minor differences") — this is the known account-level wave (see `project_asc_43a_spam_wave` memory), not a real content problem. Check that memory file for whether this app already has a drafted or filed reply. If drafted but unfiled, file it via Resolution Center (web UI, in Chrome if the CLI session is down) — `asc web review` is read-only, replies need the UI. If no draft exists, write one following the established pattern: cite prior individually-approved versions of the same app if any exist, cite the file/code overlap fraction with every other app in the account (near-zero is normal and is the whole argument), ask Apple to name the app it thinks this resembles. **Never resubmit a new build into an active spam-wave rejection** — resubmitting is what grows the wave; only appeal.
- **Any other guideline** — read it on its own merits, it's a real review comment, fix the actual thing named.
- Before filing anything that goes to Apple, quote the drafted reply back to the user and confirm before submitting — it's one-way and visible to Apple, not something to auto-send.

## 5. Update memory

Whichever of `project_asc_43a_spam_wave.md` / the app's own project memory is relevant, log: what was found, whether a new appeal was filed and its submission ID, and correct any stale "not yet filed" claims against what ASC actually shows — memory drifts from reality here fast, always verify against ASC before trusting a "filed"/"not filed" note more than a day old.
