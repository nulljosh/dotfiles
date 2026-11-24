---
name: money
description: Where the app money actually is — what Apple has paid out to the bank, what it still owes, and anything blocking payment (Paid Apps agreement, tax forms, banking, Small Business Program, payment threshold), plus Stripe web sales, all in CAD. Use for /money, "have we been paid", "Apple payout", "payments", "what's owed", "bank deposit", "tax forms", "W-8BEN", "Paid Apps agreement", or "is anything blocking our money".
---

# /money

/sales says what was sold. /money says what reached the bank, what's still owed, and what's in the way.

## 1. Sign in
Follow `~/.claude/skills/sales/asc-signin.md`. Finance reports need an API key with Finance or Admin; agreements and payments need a web session or Safari.

## 2. Headless checks (web session, every run)
```
asc web agreements status --output json        # developer program: pending must be false
asc web business agreements list --output json # Paid/Free Apps agreements, bank, tax, compliance
```
Report any `pending:true`, expired agreement, or bank/tax status that isn't Active. Accepting needs Joshua's yes in chat. The "accept new terms" emails are usually the Developer Program License Agreement.

## 3. Payouts (needs a FINANCE key)
- Finance reports come monthly by Apple fiscal month. Use region `ZZ` first, then per region (`asc finance regions`):
  `asc finance reports --vendor "$ASC_VENDOR_NUMBER" --report-type FINANCIAL --region ZZ --date 2026-10 --output ~/Documents/Josh/App\ Store/finance/2026-10-ZZ.tsv.gz`
- No key on this Mac: say so, give the `/sales` proceeds as "owed", and offer Safari's Payments page only as a last resort.
- Apple holds a region's balance until it passes the payment threshold. Say so plainly.

## 3b. Other money in
- Stripe web unlocks: unverified without a key.
- Jaybulb client invoices: `~/Documents/Jaybulb-Invoice-*.pdf`. Ask whether open ones were paid; don't assume.
- Read and update `~/Documents/Josh/App Store/STATE.md` (private, outside this repo) with the run's figures.

## 4. Report (terse)
One line: **App Store proceeds, paid out vs owed, invoices, any blocker**. If there's a blocker, that is the line.

## 5. Suggest
At most 3, ranked by dollars: fix a blocker first; then a region stuck under its threshold (nothing to do, just know it); then sales levers from `/sales`. Keep the GTM rules (free or $0.99 one-time, no subscriptions/tips/ads/tiers/price tests).
Tax notes worth flagging, not filing: keep monthly finance reports for the T2125/self-employment return; GST/HST registration becomes mandatory past $30,000 CAD in four quarters.

## Rules
- Report numbers only from a report or page you read this run; never estimate a payout.
- Keep the Apple ID, vendor number, and bank details out of this repo (it's public). Raw reports stay in `~/Documents/Josh/App Store/`.
- Update the GTM.md "The numbers" line with paid-out-to-date and date, then commit and push labs.
