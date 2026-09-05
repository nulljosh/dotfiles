---
name: domain-audit
description: Check every heyitsmejosh.com/jaybulb.com subdomain actually resolves and serves the matching app (not a 404/503/stale deploy). Use when the user asks to check if apps are live, audit domains/deploys, or invokes /domain-audit.
---

# domain-audit

Catches the Sidewise-style situation (macOS app rejected partly because ASC login was 503 for
a week and nobody noticed) before it costs a review cycle.

## Steps

1. Collect subdomains: `grep -rhoE 'https?://[a-z0-9-]+\.(heyitsmejosh|jaybulb)\.com' ~/Documents/Code/*/README.md | sort -u`.
2. `curl -s -o /dev/null -w '%{http_code}\n' --max-time 10` each URL. Flag anything not 200
   (or a sane redirect to 200).
3. For anything flagged, `curl -sI` for more detail (is it Cloudflare's own 522/1016 vs. the
   app's own error page vs. DNS not resolving at all) and note which repo owns it.
4. Report a short table: subdomain | status | repo | likely cause. Don't auto-redeploy —
   this is a detector, not a fixer; flag it and let the user (or a follow-up /wrangler session)
   decide.

## Rules
- ponytail: one curl per domain, no headless browser, no visual diffing. If curl says 200,
  that's good enough — don't chase deeper "does the content look right" checks.
