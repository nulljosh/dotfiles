---
name: appstore
description: The whole App Store business in one run — money made so far (App Store sales, payouts, Stripe, invoices), distribution (what's live, in review, rejected, badges and agreements to accept), and promotion (Product Hunt, Reddit, HN) — then one tl;dr and the 3 next steps. Runs /sales, /money and /distribution headless and reads /launch state. Use for /appstore, "how's the company doing", "how much have we made", "check everything on ASC", "resolve the ASC badges", or a weekly business check-in.
---

# /appstore

Report one line of results, then at most 3 next steps. Stay headless: Joshua uses Safari, so open a Safari tab only as a last resort, and close it afterwards.

## Run (in order, one web session)
1. **Sign in**: `~/.claude/skills/sales/asc-signin.md`. If a fresh login is needed, open Terminal for Joshua with osascript; the `!` prompt can't take a password.
2. **Money**: `/sales` step 2 (`all_apps.py`), then `/money` steps 2–3b. Headline = all-time App Store sales + Stripe + paid invoices.
3. **Distribution**: `/distribution` board + badges.
4. **Promotion** (read-only, launch skill at `~/Documents/Josh/Code/dotfiles/claude/claude-skills/launch/`):
   - Product Hunt: `python3 <launch>/producthunt.py list` (Keychain `producthunt-api`; otherwise "PH: unverified").
   - Reddit/HN: which apps have `launch/reddit/*.md` or a `Post:` line, and which live apps have none.
   - An app that sells but has no post is the top promotion candidate.
5. **Save**: compare with and append to `~/Documents/Josh/App Store/STATE.md` (private). Update GTM.md "The numbers" and commit/push labs (that repo is private; never put bank, tax or invoice details in this public one).

## Output
```
💰 $X all-time on the App Store (N paid / M downloads) · Stripe $Y · invoices $Z · nothing to accept
📦 N live · N in review · N rejected · <worst badge>
📣 <best seller> has no PH/Reddit post
Next: 1) … 2) … 3) …
```
Next steps follow the GTM rules: free or $0.99 one-time, no subscriptions/ads/tiers, one store submission a week. Never change a price, availability, submission or agreement without Joshua's yes.

## Later
Bring these numbers into Joshua's own apps. Cyllene (cyllene.jaybulb.com) already shows per-app downloads and proceeds; its roadmap still has the account dashboard with sparklines and the 7/30/90-day chart open. `all_apps.py --json` is the data shape to feed it.
