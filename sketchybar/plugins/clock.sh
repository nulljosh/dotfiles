#!/bin/sh

# The $NAME variable is passed from sketchybar and holds the name of
# the item invoking this script:
# https://felixkratz.github.io/SketchyBar/config/events#events-and-scripting

sketchybar --set "$NAME" label="$(date '+%d/%m %H:%M')"

if [ "$SENDER" = "mouse.clicked" ]; then
  sketchybar --set clock popup.drawing=toggle
else
  sketchybar --remove '/clock\.detail\..*/' 2>/dev/null
  i=0
  for part in "$(date '+%A, %B %d %Y')" "week $(date '+%V')" "$(date '+%Z (UTC%z)')"; do
    sketchybar --add item "clock.detail.$i" popup.clock \
               --set "clock.detail.$i" label="$part" icon.drawing=off \
                                       label.align=left width=200
    i=$((i+1))
  done
fi

