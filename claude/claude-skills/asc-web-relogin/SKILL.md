---
name: asc-web-relogin
description: Re-authenticate the expired asc Apple web session and finish any web-only ASC step (availability bootstrap, App Privacy publish). Use when an `asc web` command fails with "Session expired" or the user says the web login expired again.
---

# asc web re-login

Apple web sessions expire in hours by design — this is Apple, not fixable. API-key auth (`asc auth`) never expires; only `asc web ...` commands need this.

1. Check: `asc web auth status` → `{"authenticated":false}` means re-login.
2. Login is interactive (password + 2FA). Tell the user to type in the prompt:
   `! asc web auth login --apple-id "trommatic@icloud.com"`
3. After `{"authenticated":true}`, immediately run the blocked web step(s):
   - App Privacy: `asc web privacy pull` → `apply` → `publish --confirm` (409 on publish = answers not applied yet).
   - Availability bootstrap: `asc web apps availability create --app APP_ID --territory "USA,CAN,..."` — **known broken 2026-07 (404)**; fall back to dashboard: appstoreconnect.apple.com/apps/APP_ID → Pricing and Availability, one click.
4. Web-only steps are one-time per app (first submission). Don't let the user think this recurs daily — batch all web steps into the login session.

## Deleting an orphaned app record
Apple exposes no public API for this — `asc web apps delete` uses the same web-session PATCH App Store Connect's UI uses. Guard against deleting the wrong app:
```
asc web apps delete --app APP_ID --expected-bundle-id "com.example.thing" --confirm
```
`--expected-bundle-id`/`--expected-name` abort before mutating if the resolved app doesn't match — always pass one. Only delete app records already confirmed orphaned (superseded by a working merge, or never shipped) — never as a guess.

## Regulated Medical Device declaration
New ASC requirement, not in the public API. Only the "No" path is automated:
```
asc web apps medical-device set --app APP_ID --declared false
```
Use for apps that are genuinely not a regulated medical device (health/wellness trackers, not diagnostic/treatment devices). If the app actually is one, use the ASC web UI — the "Yes" write contract isn't captured here.

## Post-login checklist (2026-07-21 blockers)
Queued once Joshua runs the login himself:
- `asc web apps delete --app 6783501927 --expected-bundle-id "com.nulljosh.lingo.mac" --confirm` — Lexly Mac, confirmed orphaned (REJECTED, superseded by the merged macOS version now living under the iOS app record 6783501611).
- `asc web apps medical-device set --app 6785764864 --declared false` — Healstack, harm-reduction tracker, not a regulated device.
- Do NOT delete Talli Mac (6782661988) or Epiphany Mac (6782703473) yet — their merge-into-iOS replacements aren't confirmed working (Talli: upload fails with opaque error 90348; Epiphany: blocked on a pre-existing Swift 6 concurrency bug). Deleting the old record before the new one ships would leave those products with zero Mac listing.
