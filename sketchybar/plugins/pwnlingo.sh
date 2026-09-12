#!/bin/bash
STATE=$(curl -s --max-time 1 http://localhost:8737/state)
if [ -z "$STATE" ]; then
  sketchybar --set pwnlingo label="pwnlingo: off" icon.drawing=off
  exit 0
fi
STREAK=$(echo "$STATE" | grep -o '"streak":[0-9]*' | cut -d: -f2)
PAUSED=$(echo "$STATE" | grep -o '"paused":[a-z]*' | cut -d: -f2)
LABEL="🔥$STREAK"
[ "$PAUSED" = "true" ] && LABEL="$LABEL ⏸"
sketchybar --set pwnlingo label="$LABEL" icon.drawing=off
