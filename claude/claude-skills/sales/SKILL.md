---
name: sales
description: How much Joshua's apps have sold — pull App Store Connect sales (asc CLI, or Safari if he signs in), total downloads, paid units and proceeds per app and all-time in CAD, compare with last period, then suggest the few changes most likely to sell more within the GTM rules. Use for /sales, "how much have we made", "sales so far", "downloads", "App Store numbers", "which app sells", or "how do we sell more".
---

# /sales

Answer: how much have all the apps made so far, which ones, and what to change next.

## 1. Sign in
Follow `~/.claude/skills/sales/asc-signin.md`. Use the API path when it works, the web session next, Safari last.

## 2. Pull the numbers
All-time = every yearly report since the first launch, plus monthly reports for this year, plus daily reports for this month. Save reports to `~/Documents/Josh/App Store/sales/` (create it; keep the raw files, they are the record).
```
D=~/Documents/Josh/App\ Store/sales
asc analytics sales --vendor "$ASC_VENDOR_NUMBER" --type SALES --subtype SUMMARY --frequency YEARLY  --date 2025 --allow-missing --output "$D/y2025.tsv.gz"
asc analytics sales --vendor "$ASC_VENDOR_NUMBER" --type SALES --subtype SUMMARY --frequency MONTHLY --date 2026-10 --allow-missing --output "$D/m2026-10.tsv.gz"
asc analytics sales --vendor "$ASC_VENDOR_NUMBER" --type SALES --subtype SUMMARY --frequency DAILY   --date 2026-11-23 --allow-missing --output "$D/d2026-11-23.tsv.gz"
python3 -I ~/.claude/skills/sales/sales_sum.py "$D"/*.tsv.gz
```
Don't double count: a yearly file already covers its months. Skip files already on disk. Reports lag a day or two; `--allow-missing` handles that.

Web session only (no API key): `asc web analytics sales --app APP_ID --start … --end … --output json` per app, and `asc web analytics overview` for page views → downloads conversion.
Safari only: Sales and Trends → set the range to "All time", group by app, read Proceeds and Units.

Also note web sales: Stripe ($1 web unlocks for Epiphany, Talli, Machaon, Melete). No Stripe CLI here; read the Stripe dashboard in Safari only if Joshua asks.

## 3. Report (terse)
One line: **all-time proceeds in CAD, paid units, downloads**, then the top 3 apps by proceeds. Show the per-app table only if asked. Compare with the last run (`asc analytics compare --source sales …` or the previous snapshot) when there is one.

Update the "The numbers" section of GTM.md with the verified figure and date, then commit and push labs.

## 4. Suggest improvements
Pick at most 3, each tied to a number you just saw. Respect the GTM rules: every app is free or $0.99 one-time; **no subscriptions, tips, ads, tiers or price tests**. Good levers:
- **Conversion**: page views high, downloads low → screenshots, first screenshot caption, subtitle, icon (`/mobbin` for competitor screens, `/ui`).
- **Discovery**: few impressions → keywords and name/subtitle (`asc metadata keywords …`, `/name`), custom product pages, in-app events (`asc web analytics sources`).
- **Free → $0.99**: a free catalogue app with steady downloads and good ratings is a candidate. Price changes need Joshua's yes (`asc pricing schedule create … --price 0.99`, see GTM hard-won rules).
- **Ratings**: few ratings → an in-app `SKStoreReviewController` prompt after a success moment.
- **Reach**: missing platforms or territories → hand to `/distribution`.
- **Launch push** for the best seller → `/launch`.

## Rules
- Never change a price, metadata or availability without Joshua's yes in chat.
- One store submission a week at most (GTM rule).
- Treat proceeds as what Apple owes, not what was paid; payouts are `/money`.
- Keep the Apple ID and vendor number out of this repo (it's public).
