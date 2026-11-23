#!/bin/bash
# Every 35 minutes of a session (checked on each tool call and prompt), remind Claude to refresh and re-arm its
# background work. Silent the rest of the time. One timestamp file per session in ~/.claude/state.
# ponytail: hooks have no timer, so the clock only advances while Claude is working or being woken.
sid=$(jq -r '.session_id // "none"' 2>/dev/null)
event=$(echo "${CLAUDE_HOOK_EVENT:-PostToolUse}")
dir="$HOME/.claude/state"; mkdir -p "$dir"
f="$dir/rearm-$sid"
now=$(date +%s)
if [ ! -f "$f" ]; then echo "$now" > "$f"; exit 0; fi
last=$(cat "$f" 2>/dev/null || echo "$now")
[ $((now - last)) -lt 2100 ] && exit 0
echo "$now" > "$f"
msg="35-minute refresh: if a task is still in progress, check every background task and Monitor now (TaskStop anything stale or past 5 min, re-arm expired Monitors with a 5-minute cap, SendMessage running agents for a status), confirm long-running processes you started are alive, and keep the loop wakeup armed. Keep going until the task is finished AND verified. If nothing is in progress, ignore this."
jq -n --arg e "$event" --arg m "$msg" '{hookSpecificOutput: {hookEventName: $e, additionalContext: $m}}'
