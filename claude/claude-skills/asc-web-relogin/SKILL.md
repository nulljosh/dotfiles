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
