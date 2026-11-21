---
name: get-api-key
description: Get a new API key from a provider and wire it into the project without the user poking around a browser. Codex drives the already-logged-in Chrome session, scrapes the key, stores it (wrangler/vercel/supabase secret or .env), and runs the blocked step. Use when blocked on "get an API key" — e.g. "get my Gemma key", "grab the OpenAI key".
---

# get-api-key

The annoying part is a human opening a dashboard and clicking around. So don't make the human do it — **Codex** does it. The AI vendors you hit most (Google AI Studio, OpenAI, Anthropic) have **no key-minting CLI**; the console is the only path. But the user is already logged into those consoles in Chrome, and `Codex-in-chrome` reuses that live session — so Codex navigates, clicks "create key", and scrapes the value. Zero manual poking.

## Ladder — stop at the first rung that works

1. **Already stored?** Don't re-fetch. Check the project: `.env`, `wrangler secret list`, `vercel env ls`, `supabase secrets list`, and `env | grep -i PROVIDER`.
2. **Real CLI mints it?** A few providers do — use them, no browser:
   - GitHub: `gh auth token`
   - Supabase: `supabase projects api-keys --project-ref <ref>`
   - Vercel project vars: `vercel env pull` (existing) / tokens at vercel.com/account/tokens
   - Cloudflare: account calls already use `CLOUDFLARE_API_TOKEN` in env
3. **Cloudflare Workers-deploy token specifically → mint it once with no expiry, never again.** This is the fix for recurring wrangler/CI 2FA fatigue, not a one-off: a scoped API token has no session to expire, unlike a dashboard login. If a repo's `.github/workflows/deploy.yml` needs `CLOUDFLARE_API_TOKEN` and doesn't have one (`gh secret list --repo <owner>/<repo>` to check), drive Chrome to `dash.cloudflare.com/profile/api-tokens` → Create Token → "Edit Cloudflare Workers" template → rename it `<repo>-ci-deploy` → Account Resources: pick the account → Zone Resources: switch "Specific zone" to **All zones from an account**, pick the same account (Workers Routes is zone-scoped so this step is required or Continue blocks with "Choose a zone resource") → leave TTL blank (no expiry, this is the whole point) → Continue to summary → Create Token → copy the `cfut_...` value shown once → `gh secret set CLOUDFLARE_API_TOKEN --repo <owner>/<repo> --body "<token>"`. Verify with `gh run rerun <last failed run id>` or wait for the next push, then `gh run list --workflow=deploy.yml --limit 1`.
4. **Console only → drive Chrome (the common case for AI keys).**
   - Load tools in ONE call: `ToolSearch "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__tabs_create_mcp"`
   - `tabs_context_mcp` → new tab straight to the key page deep link (table below).
   - Click "Create/Get API key", then `read_page`/`get_page_text` to scrape the key value.
   - Session is already logged in → no credentials needed. **Only** if a login/2FA wall actually appears: tell the user to log into that tab, then continue. Never enter credentials.
   - **"Sign in with Apple" wall specifically** (Cloudflare and others offer it): Apple's own 2FA push/Face-ID approval on a trusted device can't be scripted — that step is genuinely the user's, same as ASC's `asc-login` flow. Tell them to auth in the open tab, then poll (`computer` screenshot or `get_page_text`) until the URL leaves the login/redirect path before continuing. If the destination service also texts a 6-digit code (distinct from Apple's own push), `~/.local/bin/asc-2fa-code`'s SMS-read pattern (`sqlite3 ~/Library/Messages/chat.db`, filtered to messages after a start timestamp) generalizes to any provider's SMS code, not just ASC — reuse that approach rather than asking the user to relay the digits by hand.

## Provider key pages (deep links — skip the nav)

| Provider | URL |
|----------|-----|
| Google AI Studio (Gemma/Gemini) | aistudio.google.com/app/apikey |
| OpenAI | platform.openai.com/api-keys |
| Anthropic | console.anthropic.com/settings/keys |
| Cloudflare | dash.cloudflare.com/profile/api-tokens |
| Vercel | vercel.com/account/tokens |
| Supabase | supabase.com/dashboard/project/_/settings/api |

## Store it where the code reads it

Grep the repo for the var name to see how it's consumed, then store to match:
- Cloudflare Worker: `wrangler secret put PROVIDER_KEY` (paste) → `wrangler deploy`
- Vercel: `vercel env add PROVIDER_KEY production`
- Supabase Edge fn: `supabase secrets set PROVIDER_KEY=...`
- Local/CLI: append to project `.env` — confirm it's gitignored first, never commit a key

## After storing

- Run the follow-on step that was blocked (deploy, `asc workflow run ship-ios`, etc.).
- If the key was a tracked blocker, update memory/roadmap.

ponytail: no key-vault abstraction or per-provider scripts — a table + ladder is the whole skill; providers differ too much to unify.
