---
name: sales
description: How much Joshua's apps have sold — pull App Store Connect sales (asc CLI, or Safari if he signs in), total downloads, paid units and proceeds per app and all-time in CAD, compare with last period, then suggest the few changes most likely to sell more within the GTM rules. Use for /sales, "how much have we made", "sales so far", "downloads", "App Store numbers", "which app sells", or "how do we sell more".
---

# /sales

Answer: how much have all the apps made so far, which ones, and what to change next.

## 1. Sign in
Follow `~/.claude/skills/sales/asc-signin.md`. Use the API path when it works, the web session next, Safari last.

## 2. Pull the numbers
**Headless, web session (works now):**
```
set -a; . ~/.config/asc.env; set +a
python3 -I ~/.claude/skills/sales/all_apps.py --json > ~/Documents/Josh/App\ Store/sales/alltime-$(date +%F).json
python3 -I ~/.claude/skills/sales/all_apps.py
```
All-time units (first downloads), sales and proceeds per app, in USD. About 2 s per app. Analytics round each day to whole dollars, so for cents use paid sales × $0.84 (Small Business Program) or the API reports below.

**Exact cents (needs a FINANCE key, rung 1):** yearly + monthly + daily `asc analytics sales --vendor "$ASC_VENDOR_NUMBER" --type SALES --subtype SUMMARY …` into `~/Documents/Josh/App Store/sales/`, then `python3 -I ~/.claude/skills/sales/sales_sum.py <files>` (converts to CAD). A yearly file already covers its months, so don't double count.

**Stripe** (web $1 unlocks): no CLI or key on this Mac. GTM.md had zero charges ever as of 2026-09-06. Say "Stripe: unverified" unless Joshua shares the dashboard.

Last run's numbers and private details live in `~/Documents/Josh/App Store/STATE.md` (outside this public repo). Read it to compare, then add a dated section.

## 3. Report (terse)
One line: **all-time proceeds in CAD, paid units, downloads**, then the top 3 apps by proceeds. Show the per-app table only if asked. Compare with the last run (`asc analytics compare --source sales …` or the previous snapshot) when there is one.

Update the "The numbers" section of GTM.md with the verified figure and date, then commit and push labs.

## 4. Suggest improvements
Pick at most 3, each tied to a number you just saw. Respect the GTM rules: every app is free or $0.99 one-time; **no subscriptions, tips, ads, tiers or price tests**. Good levers:
- **Conversion**: page views high, downloads low → screenshots, first screenshot caption, subtitle, icon (`/mobbin` for competitor screens, `/ui`).
- **Discovery**: few impressions → keywords and name/subtitle (`asc metadata keywords …`, `/name`), custom product pages, in-app events (`asc web analytics sources`).
- **Free → $0.99: test one app at a time.** Compare equal windows right before and after against the free group's trend; a longer baseline mixes in launch spikes and fakes a drop (that happened in Nov 2026, see STATE.md). Price changes need Joshua's yes.
- **Ratings**: few ratings → an in-app `SKStoreReviewController` prompt after a success moment.
- **Reach**: missing platforms or territories → hand to `/distribution`.
- **Launch push** for the best seller → `/launch`.

## Rules
- Never change a price, metadata or availability without Joshua's yes in chat.
- One store submission a week at most (GTM rule).
- Treat proceeds as what Apple owes, not what was paid; payouts are `/money`.
- Keep the Apple ID and vendor number out of this repo (it's public).
