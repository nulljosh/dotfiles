---
name: get-api-key
description: Get a new API key from a provider and wire it into the project without the user poking around a browser. Claude drives the already-logged-in Chrome session, scrapes the key, stores it (wrangler/vercel/supabase secret or .env), and runs the blocked step. Use when blocked on "get an API key" — e.g. "get my Gemma key", "grab the OpenAI key".
---

# get-api-key

The annoying part is a human opening a dashboard and clicking around. So don't make the human do it — **Claude** does it. The AI vendors you hit most (Google AI Studio, OpenAI, Anthropic) have **no key-minting CLI**; the console is the only path. But the user is already logged into those consoles in Chrome, and `claude-in-chrome` reuses that live session — so Claude navigates, clicks "create key", and scrapes the value. Zero manual poking.

## Ladder — stop at the first rung that works

1. **Already stored?** Don't re-fetch. Check the project: `.env`, `wrangler secret list`, `vercel env ls`, `supabase secrets list`, and `env | grep -i PROVIDER`.
2. **Real CLI mints it?** A few providers do — use them, no browser:
   - GitHub: `gh auth token`
   - Supabase: `supabase projects api-keys --project-ref <ref>`
   - Vercel project vars: `vercel env pull` (existing) / tokens at vercel.com/account/tokens
   - Cloudflare: account calls already use `CLOUDFLARE_API_TOKEN` in env
3. **Console only → drive Chrome (the common case for AI keys).**
   - Load tools in ONE call: `ToolSearch "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__tabs_create_mcp"`
   - `tabs_context_mcp` → new tab straight to the key page deep link (table below).
   - Click "Create/Get API key", then `read_page`/`get_page_text` to scrape the key value.
   - Session is already logged in → no credentials needed. **Only** if a login/2FA wall actually appears: tell the user to log into that tab, then continue. Never enter credentials.

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
