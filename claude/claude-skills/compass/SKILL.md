---
name: compass
description: Check Compass Card balance and reload it at compasscard.ca (TransLink Metro Vancouver) via the logged-in Chrome session. Use when the user says /compass, "compass balance", "how much is on my Compass card", or asks to reload/top up their Compass Card.
---

# Compass Card

No public API. Everything goes through compasscard.ca in the user's existing Chrome session.

## Balance (default action)

1. `mcp__claude-in-chrome__tabs_context_mcp` — reuse an open compasscard.ca tab if there is one, else `tabs_create_mcp`.
2. Navigate to `https://www.compasscard.ca/ManageCards` — the real dashboard. Do NOT guess other deep paths (`/CustomerPortal/Dashboard` 404s); follow the site's own links.
3. `get_page_text`. If the header shows **Sign In / Register**, there is no session: tell the user to sign in at compasscard.ca and stop. Do not type credentials.
4. Signed in, the dashboard lists each card with its stored value and any active pass.

Guest option: the home page has a "Check your card balance" form (20-digit card number + 3-digit security code). Only use it if the user hands over those numbers in chat.

Report: card nickname, stored value, pass status, and AutoLoad rule if set. That's it.

If AutoLoad is on and the balance is above its trigger, say so and skip the reload offer — the card tops itself up.

Never ask for or accept the account password. The Chrome session persists; if it lapses the user signs in themselves.

## Reload — always confirm first

Money leaves an account. Never reload unprompted, and never pick the amount yourself.

1. Read the balance first (above) so the user is deciding with real numbers.
2. `AskUserQuestion`: which card, and how much ($10 / $20 / $50 / other).
3. Dashboard → **Load** / **Add Value** on that card → choose Stored Value, enter the amount, use the saved payment method.
4. Stop at the final confirmation screen. Screenshot it, show the total, and get an explicit "yes" before clicking the last submit button.
5. After submitting, `get_page_text` the receipt and report the confirmation number and new balance.

If no saved payment method exists, stop — hand it back to the user rather than entering card numbers.

## Notes

- compasscard.ca is TransLink (Metro Vancouver). BC Transit outside Metro Van uses Umo, a different system — say so if the card isn't there.
- Auto-load settings live under Card Settings; only touch them if asked.
- Don't click anything that opens a browser confirm/alert dialog — it freezes the extension.
