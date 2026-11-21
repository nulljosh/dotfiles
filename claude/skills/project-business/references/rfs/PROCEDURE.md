---
name: rfs
description: Pull YC's current Requests for Startups through sparkjar's connector, rank them for what Joshua can actually ship, and optionally build the winner. Use when the user says /rfs, "YC ideas", "requests for startups", "what should I build", or asks to rank startup ideas by best and easiest.
---

# /rfs

`/rfs` ranks. `/rfs build` ranks and then builds #1 the tripwire way.

## 1. Fetch

```sh
curl -s 'https://sparkjar.heyitsmejosh.com/api/ai?type=rfs' | python3 -c "
import json,sys
for r in json.load(sys.stdin)['rfs']: print(f\"## {r['title']} ({r['author']})\n{r['description'][:900]}\n\")"
```

Source is `sparkjar/api/ai.js` (`handleRfs`, scrapes ycombinator.com/rfs, 12h cache). If the
endpoint 502s the YC page markup changed: fix `RFS_ENTRY_RE` there, don't scrape here.

## 2. Rank

Score each idea on best × easiest **for Joshua specifically**. Facts that decide it:

- Solo dev. Stack: Cloudflare Workers/Pages + KV/DO, Supabase, Swift (iOS/macOS), KMP.
- No hardware, no defense, no crypto wedge, no sales team, Vancouver.
- Already runs: ~20 small apps, gh, wrangler, asc, Workers AI. Reuse beats new.
- "Easy" means a credible v0 in a weekend where he is his own first user.

Bucket ease as Easy / Easy-Med / Med / Hard / Hardware / No. Output one table:
`# | RFS | Author | Ease | why`, then one line naming the pick. Skip hardware, defense,
crypto with a one-word reason. If two are close, prefer the one that dogfoods on his repos.

Reply TLDR-first (feedback: tldr-default). Follow-up "shorter?" means one sentence.

## 3. Build (only on `/rfs build` or when asked)

Precedent: tripwire (2026-09-01). Recipe:

1. Name it (check `gh api repos/nulljosh/<name>` is 404). One word.
2. `~/Documents/Code/<name>`: one `worker.js`, `wrangler.toml`, `test.js` (one assert-based
   check), `README.md` from `~/Documents/Code/README-TEMPLATE.md` (Joshua's voice, Jobs arc),
   `icon.svg`, `web/index.html` copied from swing's page style with `tokens.css`.
3. `architecture-svg` skill for the diagram.
4. `gh repo create nulljosh/<name> --private`, `env -u CLOUDFLARE_API_TOKEN npx wrangler deploy`,
   custom domain `<name>.heyitsmejosh.com`, `gh repo edit --homepage`.
5. Prove the core path end to end with a real artifact (an issue, a row, a file), not a log line.
6. Point it at Joshua's real repos and APIs, write `DOCS.md`, memory file, then `/wrapup`.

Gotchas: Workers Free allows 5 cron triggers total. Secrets via `wrangler secret put`, never git.
