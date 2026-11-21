#!/bin/bash
# Inject real Claude plan usage (session/weekly limit %) into context on each prompt (cached 5 min).
# ponytail: ccusage's local token-cost projection was wrong for a subscription plan
# (it estimated pay-per-token spend/time-to-limit from JSONL logs, unrelated to the
# account's actual rate-limit window) — switched to the OAuth usage endpoint via
# ~/.claude/scripts/usage.sh, which is what the menu bar app reads too.
cache=/tmp/claude-usage-hook-cache

# Free space on the data volume, every prompt, uncached. The disk hits 0 often enough to stop
# a session dead (Bash itself fails with ENOSPC before anything runs), and by then the agent
# cannot even run df to find out why. Warn while there is still room to act.
free_gb=$(df -g /System/Volumes/Data 2>/dev/null | awk 'NR==2 {print $4}')
disk=""
if [ -n "$free_gb" ] && [ "$free_gb" -lt 15 ]; then
  disk="[disk] ${free_gb}GB free — run /cleanup before any heavy job, and keep large outputs off this volume"
fi

if [ -s "$cache" ] && [ $(( $(date +%s) - $(stat -f %m "$cache") )) -lt 300 ]; then
  out=$(cat "$cache")
else
  out=$(bash "$HOME/.claude/scripts/usage.sh" 2>/dev/null)
  [ -n "$out" ] && out="[usage] $out"
  [ -n "$out" ] && echo "$out" > "$cache"
fi
[ -n "$out" ] && echo "$out"
[ -n "$disk" ] && echo "$disk"
exit 0
