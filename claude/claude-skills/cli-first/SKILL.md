---
name: cli-first
description: Reference card — CLI/MCP alternatives to browser automation, by task domain
---

# CLI-First Reference

Before reaching for claude-in-chrome or chrome-devtools, check here.

## GitHub
```
gh issue list / view / create / close
gh pr list / view / create / merge / comment
gh release create / list
gh repo view / clone
gh gist create
```

## Vercel
```
vercel ls / deploy / logs / env
vercel domains / alias
```
Or: Vercel MCP tools (`mcp__plugin_vercel_vercel__*`)

## Supabase
```
supabase db push / diff / reset
supabase functions deploy / serve
supabase gen types typescript
```
Or: Supabase MCP tools (`mcp__supabase__*`)

## App Store Connect
```
asc apps list / builds / beta-groups / submissions
asc testflight / metadata / screenshots
```

## Cloudflare
```
wrangler deploy / tail / kv / r2 / pages
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/...
```

## Generic web content / APIs
- `WebFetch` tool — fetch any URL, get page text or JSON
- `curl` — raw HTTP, great for REST APIs with known endpoints

## Google services
- Gmail MCP (`mcp__claude_ai_Gmail__*`) — search, read, draft, label
- Google Calendar MCP — events, scheduling
- Google Drive MCP — files, sheets

## When browser IS the right call
- Need to see rendered UI (screenshots, visual QA)
- OAuth/login flow with no CLI equivalent
- Web app with no public API and no CLI tool
- Filling multi-step forms that can't be scripted via curl
