#!/bin/bash
# ponytail: reuses existing usage.sh, just picks the weekly_all percent for the bar
LINE=$(~/.claude/scripts/usage.sh 2>/dev/null | grep -o 'weekly_all [0-9]*%[^|]*')
PCT=$(echo "$LINE" | grep -o '[0-9]*%' | head -1 | tr -d '%')
[ -z "$PCT" ] && sketchybar --set claude_usage label="--" icon.color=0xffffffff && exit 0

COLOR=0xff00ff00
[ "$PCT" -ge 70 ] && COLOR=0xffffaa00
[ "$PCT" -ge 90 ] && COLOR=0xffff0000

sketchybar --set claude_usage label="${PCT}%" icon.color=$COLOR
