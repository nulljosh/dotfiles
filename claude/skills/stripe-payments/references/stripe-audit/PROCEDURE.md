---
name: stripe-audit
description: Check whether web payments actually work across the fleet (Epiphany, Sparkjar, Healstack, Talli) without a credit card. Read-only Stripe health check, dead webhook detection, and the $0 coupon end-to-end test. Use when the user asks "can people pay on the website", "stripe gaps", "has anyone ever paid", "test checkout", or invokes /stripe-audit.
---

# Stripe audit

The App Store sells the apps. The question here is the website: can a stranger pay, and does Pro unlock after.

## 1. Read-only check (always first, no approval needed)

`/Users/joshua/Documents/Code/dotfiles/claude/skills/stripe-payments/references/stripe-audit/scripts/audit.sh`

What it prints and how to read it:
- **charges**: real money ever taken. 0 means no web sale has ever happened.
- **checkouts**: `complete paid 0` is a coupon test, not a sale.
- **webhooks**: each URL is POSTed unsigned. `400` = alive and checking signatures (good). `000` = dead host, delete it.
- **pending_webhooks > 0**: endpoints that never got that purchase. Stripe stops retrying after 3 days, so those unlocks never happened.
- **promo-code box**: `0` means that app's checkout has no code field, so the $0 test cannot run there until `allow_promotion_codes: true` is added to its session create.

Every endpoint receives every app's checkout event. Handlers must ignore prices that are not theirs.

## 2. The $0 test (proves checkout + webhook + unlock, no card)

1. Create a coupon: 100% off, duration once, max 5 uses, expires in a week. Add a promotion code to it.
2. On the app's site, sign in, buy Pro, enter the code. Stripe skips the card at $0.
3. Confirm Pro unlocked in the app, then rerun audit.sh: the new event should show `pending 0`.
4. Deactivate the promo code after.

A real card only adds the bank leg. Stripe keeps its fee on a refund, so the $0 test is the default.

## 3. Writes need Joshua

Creating coupons and deleting webhooks are live account changes. The auto-mode classifier blocks them from Bash and from Chrome clicks, so do not retry or route around it. Options, in order:
1. Joshua approves the exact command when prompted, or adds an allow rule for it.
2. Official Stripe MCP (`claude plugin install stripe@claude-plugins-official`, or remote `https://mcp.stripe.com` with OAuth). Its tools cover coupons, products, prices and webhook endpoints, so no Chrome. Writes still prompt.
3. Stripe CLI (`stripe coupons create ...`, `stripe webhook_endpoints delete we_...`), also in the dashboard under Workbench → Shell.
4. Last resort: leave the dashboard page open and tell Joshua which button to click.

## Known state (2026-10-01)

Zero real charges ever. One $0 Epiphany coupon checkout on 2026-09-08, 2 of 5 webhooks undelivered (one is the dead opticon URL, the old Epiphany name). Only Epiphany's checkout takes promo codes.

## Prior art

- [stripe/agent-toolkit](https://github.com/stripe/agent-toolkit): official MCP server and toolkit.
- [appeeky/stripe-skills](https://github.com/appeeky/stripe-skills): analytics skills, including a coupon and promo audit.
- [hookdeck/webhook-skills](https://github.com/hookdeck/webhook-skills): webhook handler and signature verification skills.
None of them do the fleet check above (every app's endpoint alive, every purchase delivered, every checkout testable at $0), which is why this skill exists.
