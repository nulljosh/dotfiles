---
name: asc-web-relogin
description: Re-authenticate the expired asc Apple web session and finish any web-only ASC step (availability bootstrap, App Privacy publish). Use when an `asc web` command fails with "Session expired" or the user says the web login expired again.
---

# asc web re-login

Apple web sessions expire in hours by design — this is Apple, not fixable. API-key auth (`asc auth`) never expires; only `asc web ...` commands need this.

1. Check: `asc web auth status` first — it's often still valid (`"source":"cache"`). `{"authenticated":false}` means re-login.
2. Only the 2FA code is interactive. Apple ID and password are already in the macOS Keychain (`asc-web-appleid` / `asc-web-password`, stored by asc itself) and `~/.local/bin/asc-login` reads them — never ask the user for the password. Tell them to type in the prompt, with the 6-digit code from their trusted-device dialog:
   `! asc-login`
   With no args it checks the session first and only prompts for the code if it actually expired — so it's safe to tell the user to run it blind. `asc-login 123456` also works if they already have the code.
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

## Post-login queue (verify before running — this list goes stale)
Re-check current state with `asc apps list` / `asc web auth status` before acting on any line here.
- `asc web apps medical-device set --app 6785764864 --declared false` — Healstack, harm-reduction tracker, not a regulated device.
- Do NOT delete Talli Mac (6782661988) or Epiphany Mac (6782703473) — their merge-into-iOS replacements aren't confirmed working (Talli: upload fails with opaque error 90348; Epiphany: blocked on a pre-existing Swift 6 concurrency bug). Deleting the old record before the new one ships would leave those products with zero Mac listing.
- Resolved 2026-07-29: Lexly Mac (6783501927) and Sparkjar Mac — both resubmitted and WAITING_FOR_REVIEW; the old "delete orphaned Lexly Mac record" line no longer applies.
