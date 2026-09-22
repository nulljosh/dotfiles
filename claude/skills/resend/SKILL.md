---
name: resend
description: Send transactional email via Resend, verify domains/keys, or brand a new app's Supabase auth emails (including password reset) through the shared authmail Worker. Use when the user says /resend, asks about email delivery, forgot-password/reset emails, or wants a new app added to authmail.
---

# Resend

One Resend account (`re_...` in `secrets.fish` as `RESEND_API_KEY`, mirrored as a Worker secret on `authmail`). Three verified sending domains as of 2026-09: `heyitsmejosh.com`, `sparkjar.heyitsmejosh.com`, `epiphany.heyitsmejosh.com`.

[[reference_local_secrets_stale]] applies here too — if a send fails with 401, don't trust the on-disk key, re-check the live Worker secret:
```bash
curl -s https://api.resend.com/domains -H "Authorization: Bearer $RESEND_API_KEY"
cd ~/Documents/Code/authmail && npx wrangler secret list
```

## Architecture — don't build a new integration

Every app's auth email (signup, magic link, invite, email change, reauthentication, **password reset/recovery**) already flows through one path:

```
Supabase Auth "Send Email" hook → authmail Cloudflare Worker → Resend → user
```

`~/Documents/Code/authmail/src/index.js` is the whole thing — a `THEMES` map keyed by redirect-URL substring, subject/body copy per `email_action_type`, Svix webhook verification, one `fetch` to `api.resend.com/emails`. Password reset is the `recovery` type — it is not a separate feature, just another row in `SUBJECT`/`BODY`.

**Welcome email** rides the same request as the signup confirmation — when `type === "signup"`, the Worker fires a second Resend call (`welcome` type) right after the confirm email sends. No separate DB webhook or post-confirmation trigger; it lands the moment they sign up, alongside the "click to verify" email, both themed via the same `THEMES` row.

**Adding a new app to branded auth email = one line.** Add a row to `THEMES` in `src/index.js`:
```js
myapp: { name: "MyApp", accent: "#RRGGBB", match: ["myapp", "my-app"] },
```
`match` strings are checked against the auth email's `redirect_to`/`site_url` (lowercased, substring match). Then deploy:
```bash
cd ~/Documents/Code/authmail && npx wrangler deploy
```
No new Worker, no new Resend domain, no per-app API key. Confirm the Supabase project's Auth → Hooks → "Send Email" hook points at `https://authmail.<worker-domain>/<project-ref>` — that's the only per-app wiring outside the THEMES row.

## Ad-hoc / one-off sends (not auth emails)

Direct Resend API call, no library needed — it's one POST:
```bash
curl -s https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"Name <noreply@heyitsmejosh.com>","to":["user@example.com"],"subject":"...","html":"..."}'
```
`from` must use a verified domain above. For agent-driven notification emails unrelated to any app's own auth flow, prefer [[project_primitive_email]] instead of adding Resend calls to random scripts.

## Don't

- Don't add the `resend` npm package — a Worker's single `fetch` call doesn't need an SDK.
- Don't create a second email-sending Worker per app — authmail is shared on purpose (one key, one place to rotate, one THEMES map).
- Don't assume password reset needs separate wiring — it's already live wherever authmail is already wired for that Supabase project.
