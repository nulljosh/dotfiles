#!/bin/bash
# Inject real Claude plan usage (session/weekly limit %) into context on each prompt (cached 5 min).
# ponytail: ccusage's local token-cost projection was wrong for a subscription plan
# (it estimated pay-per-token spend/time-to-limit from JSONL logs, unrelated to the
# account's actual rate-limit window) — switched to the OAuth usage endpoint via
# ~/.claude/scripts/usage.sh, which is what the menu bar app reads too.
cache=/tmp/claude-usage-hook-cache
if [ -s "$cache" ] && [ $(( $(date +%s) - $(stat -f %m "$cache") )) -lt 300 ]; then
  cat "$cache"; exit 0
fi
out=$(bash "$HOME/.claude/scripts/usage.sh" 2>/dev/null)
[ -n "$out" ] && out="[usage] $out"
[ -n "$out" ] && echo "$out" > "$cache"
echo "$out"
