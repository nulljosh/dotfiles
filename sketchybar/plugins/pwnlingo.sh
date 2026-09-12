#!/bin/bash
STATE=$(curl -s --max-time 1 http://localhost:8737/state)
if [ -z "$STATE" ]; then
  sketchybar --set pwnlingo label="pwnlingo: off" icon.drawing=off
  exit 0
fi
STREAK=$(echo "$STATE" | grep -o '"streak":[0-9]*' | cut -d: -f2)
PAUSED=$(echo "$STATE" | grep -o '"paused":[a-z]*' | cut -d: -f2)
LANG=$(echo "$STATE" | grep -o '"language":"[^"]*"' | cut -d'"' -f4)
XP=$(echo "$STATE" | grep -o '"xp":[0-9]*' | cut -d: -f2)
LABEL="🔥$STREAK"
[ "$PAUSED" = "true" ] && LABEL="$LABEL ⏸"
sketchybar --set pwnlingo label="$LABEL" icon.drawing=off

if [ "$SENDER" = "mouse.clicked" ]; then
  sketchybar --set pwnlingo popup.drawing=toggle
else
  sketchybar --remove '/pwnlingo\.detail\..*/' 2>/dev/null
  i=0
  for part in "streak: $STREAK" "language: ${LANG:-unknown}" "xp: ${XP:-0}" "paused: ${PAUSED:-false}"; do
    sketchybar --add item "pwnlingo.detail.$i" popup.pwnlingo \
               --set "pwnlingo.detail.$i" label="$part" icon.drawing=off \
                                          label.align=left width=200
    i=$((i+1))
  done
fi
