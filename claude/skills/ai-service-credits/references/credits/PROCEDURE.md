---
name: credits
description: Check remaining API credits for ElevenLabs and Higgsfield in one shot. Use when the user says /credits, "elevenlabs credits", "higgsfield credits", "how many credits left", or asks about voice/video generation balance.
---

# Credits

Run this, report one line per service, nothing else:

```sh
K=$(grep -oE "ELEVENLABS_API_KEY ['\"]?[^'\" ]+" ~/.config/fish/secrets.fish | awk '{print $2}' | tr -d "'\"")
curl -s https://api.elevenlabs.io/v1/user/subscription -H "xi-api-key: $K" | python3 -c '
import json,sys,datetime as d; s=json.load(sys.stdin)
if "tier" not in s: print("ElevenLabs: key lacks user_read"); sys.exit()
lim,used,tier,r=s["character_limit"],s["character_count"],s["tier"],s["next_character_count_reset_unix"]
print(f"ElevenLabs: {lim-used:,} of {lim:,} credits left ({tier}), resets {d.date.fromtimestamp(r)}")'
higgsfield account status 2>&1 | sed 's/^[^ ]* — /Higgsfield app (CLI, MCP): /'
bash ~/.claude/skills/character-creator/scripts/spend.sh 2>&1 | sed 's/^Higgsfield: /Higgsfield API (pay as you go): /'
```

Never print the key or the account email.

**Higgsfield has two separate balances. Always report both and never mix them up.**
- **API** (open.higgsfield.ai/billing): dollars, pay as you go, no plan, card on file. This is the one Joshua tops up. It funds `HIGGSFIELD_API_KEY` renders (Seedance via api.higgsfield.ai, character-creator scripts). There is no balance endpoint, so the number is the spend.sh ledger. When it matters, read the real figure off the billing page and `spend.sh set <dollars>`.
- **App** (higgsfield.ai): credits, free plan. Funds the `higgsfield` CLI and the claude.ai Higgsfield MCP. Topping it up means a monthly plan, and Joshua does not buy plans.
- To render without a plan, use the API account.

If ElevenLabs says the key lacks `user_read`: the Turing voice key is TTS-only. Tell Joshua to enable "User: Read" on it at elevenlabs.io/app/settings/api-keys, or `open -a "Google Chrome" https://elevenlabs.io/app/subscription` so he can read it himself. Don't drive Chrome for it.

If Higgsfield says not logged in: `higgsfield auth login` is interactive, so have him run `! higgsfield auth login`.
