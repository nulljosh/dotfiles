---
name: topup
description: Top up a prepaid AI service (Higgsfield developer API balance, Higgsfield app credits, ElevenLabs credits) without Joshua hunting for the page. Checks the balance, opens the exact billing page in Chrome, names the amount, stops at Pay for Joshua to click, then recalibrates the spend ledger and resumes the blocked render. Use when a render fails with "balance too low" or "credit balance is too low", when the user says /topup, "top up", "add credits", or before a batch of renders.
---

# topup

Claude never pays. It gets Joshua to the Pay button with the balance checked and the amount picked, then verifies after he clicks.

## Which account

| Service | What it funds | Check | Page |
|---|---|---|---|
| Higgsfield developer API | `HIGGSFIELD_API_KEY` renders: Seedance, Soul portraits, loop.sh, render.sh | `~/.claude/skills/character-creator/scripts/spend.sh` (ledger estimate, no balance API) | https://open.higgsfield.ai/billing |
| Higgsfield app | `higgsfield` CLI jobs | `higgsfield account status` | https://higgsfield.ai (Billing in the account menu) |
| ElevenLabs | voice lines, clones | `curl -s https://api.elevenlabs.io/v1/user/subscription -H "xi-api-key: $ELEVENLABS_VOICE_KEY"` (needs user_read on the key) | https://elevenlabs.io/app/subscription |

Keys live in `~/.config/fish/secrets.fish`. Never print them.

## Steps

1. Check the balance with the command above and say what is left in plain numbers.
2. Open the page in Chrome (`mcp__claude-in-chrome__navigate`; `open -a "Google Chrome"` first if it is closed). Say which account it is, since Higgsfield has two.
3. Name the amount. Default $20 on the Higgsfield API: about seven 8 s renders at 480p or two at 720p. Joshua clicks the amount and Pay himself. Never click Pay, never type card details, never dismiss a bank verification sheet.
4. When he says it went through, verify: app and ElevenLabs by the check command; the API has no balance endpoint, so read the number off the billing page (`get_page_text`) and run `spend.sh set <dollars>`.
5. Re-run the step that was blocked.

## Prices seen (2026-10-02)

- Seedance 2.5 reference-to-video on the API: about $0.14 per second at 480p; 720p is about 2.3x (56 app credits vs 24 for 8 s).
- Soul v2 portrait: about $0.05.
- ElevenLabs Starter: CA$1.66 first month, then about CA$9.93; includes instant voice cloning, 30k credits a month.

## What we found (2026-10-02)

- The ledger drifts. `spend.sh` said $3.04 when the dashboard said $1.14, so a 720p render bounced. Read the balance off the billing page first and `spend.sh set` it, every time.
- The API account had no card on file. The first top-up means Joshua types a card; Stripe Link is not offered there.
- Claude can open the Add funds dialog (Add funds button under the balance; minimum $5, presets $5 to $1,000) but the permission classifier blocks typing an amount or clicking Buy. That is the handoff point, not a bug to work around.
- Free money on that page: $5 for verifying the business email, $15 cashback after the first $100 topped up.

## Rules

- Say "top up" when the next render will not fit; do not wait for the API to refuse it. A refused render charges nothing, but it costs a round trip.
- Never let a balance hit zero: stop at the last render that fits and ask.
