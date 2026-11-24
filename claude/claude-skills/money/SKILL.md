---
name: money
description: Where the app money actually is — what Apple has paid out to the bank, what it still owes, and anything blocking payment (Paid Apps agreement, tax forms, banking, Small Business Program, payment threshold), plus Stripe web sales, all in CAD. Use for /money, "have we been paid", "Apple payout", "payments", "what's owed", "bank deposit", "tax forms", "W-8BEN", "Paid Apps agreement", or "is anything blocking our money".
---

# /money

/sales says what was sold. /money says what reached the bank, what's still owed, and what's in the way.

## 1. Sign in
Follow `~/.claude/skills/sales/asc-signin.md`. Finance reports need an API key with Finance or Admin; agreements and payments need a web session or Safari.

## 2. Payouts (what Apple paid)
- Finance reports are monthly, by Apple fiscal month, one per region. Pull every month since the first paid sale, region `ZZ` (all regions consolidated) first; fall back to per-region (`asc finance regions`) if ZZ is refused:
  `asc finance reports --vendor "$ASC_VENDOR_NUMBER" --report-type FINANCIAL --region ZZ --date 2026-10 --output ~/Documents/Josh/App\ Store/finance/2026-10-ZZ.tsv.gz`
- The Payments page in Safari (link in asc-signin.md) shows each payment's date, amount in CAD, and the **owed but unpaid** balance per region. Read it with `get_page_text`. Apple pays a region only once its balance passes that region's threshold, so small balances sit there; say so plainly.
- Cross-check against the bank only if Joshua offers a statement; never ask for bank logins.

## 3. Blockers (check every run)
- `asc web agreements status` and `asc web business agreements list`: Paid Apps agreement must be **Active**. Expired or "pending user info" = no payouts and paid apps pulled from sale.
- Business page: bank account set, tax forms complete (Canadian developer: W-8BEN with the treaty claim, so US sales aren't withheld at 30%; Canadian tax info), contact info current.
- Small Business Program enrolled (15% commission instead of 30%). GTM assumes $0.84 per $0.99 sale; if proceeds per unit look like ~$0.69, enrolment lapsed.
- Accept nothing (`… accept --confirm`) without Joshua's yes in chat.

## 4. Report (terse)
One line: **paid out to date (CAD), owed now (CAD), any blocker**. If there's a blocker, that is the line.

## 5. Suggest
At most 3, ranked by dollars: fix a blocker first; then a region stuck under its threshold (nothing to do, just know it); then sales levers from `/sales`. Keep the GTM rules (free or $0.99 one-time, no subscriptions/tips/ads/tiers/price tests).
Tax notes worth flagging, not filing: keep monthly finance reports for the T2125/self-employment return; GST/HST registration becomes mandatory past $30,000 CAD in four quarters.

## Rules
- Report numbers only from a report or page you read this run; never estimate a payout.
- Keep the Apple ID, vendor number, and bank details out of this repo (it's public). Raw reports stay in `~/Documents/Josh/App Store/`.
- Update the GTM.md "The numbers" line with paid-out-to-date and date, then commit and push labs.
