#!/bin/bash
# ponytail: reuses existing usage.sh, just picks the weekly_all percent for the bar
FULL=$(~/.claude/scripts/usage.sh 2>/dev/null)
LINE=$(echo "$FULL" | grep -o 'weekly_all [0-9]*%[^|]*')
PCT=$(echo "$LINE" | grep -o '[0-9]*%' | head -1 | tr -d '%')
[ -z "$PCT" ] && sketchybar --set claude_usage label="--" icon.color=0xffffffff && exit 0

COLOR=0xff00ff00
[ "$PCT" -ge 70 ] && COLOR=0xffffaa00
[ "$PCT" -ge 90 ] && COLOR=0xffff0000

sketchybar --set claude_usage label="${PCT}%" icon.color=$COLOR

if [ "$SENDER" = "mouse.clicked" ]; then
  sketchybar --set claude_usage popup.drawing=off --set pwnlingo popup.drawing=off --set clock popup.drawing=off
  sketchybar --set claude_usage popup.drawing=toggle
elif [ -n "$FULL" ]; then
  sketchybar --remove '/claude_usage\.detail\..*/' 2>/dev/null
  i=0
  IFS='|' read -ra PARTS <<< "$FULL"
  for part in "${PARTS[@]}"; do
    part="$(echo "$part" | sed 's/^ *//;s/ *$//')"
    sketchybar --add item "claude_usage.detail.$i" popup.claude_usage \
               --set "claude_usage.detail.$i" label="$part" icon.drawing=off \
                                              label.align=left width=260
    i=$((i+1))
  done
fi
