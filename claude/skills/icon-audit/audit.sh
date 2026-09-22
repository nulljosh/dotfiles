#!/bin/bash
# ponytail: dims+alpha only; full-bleed/shape checks need eyeballs
for set in $(find ~/Documents/Code -maxdepth 4 -name "AppIcon.appiconset" -not -path "*/node_modules/*"); do
  proj=${set#$HOME/Documents/Code/}
  png=$(ls -S "$set"/*.png 2>/dev/null | grep -viE "dark|tinted" | head -1)  # dark/tinted variants need alpha
  if [ -z "$png" ]; then echo "❌ $proj — NO PNG in iconset"; continue; fi
  dims=$(sips -g pixelWidth -g pixelHeight "$png" | awk '/pixel/{printf "%sx", $2}' | sed 's/x$//')
  alpha=$(sips -g hasAlpha "$png" | awk '/hasAlpha/{print $2}')
  flag="✅"
  [ "$dims" != "1024x1024" ] && flag="❌ not 1024x1024"
  [ "$alpha" = "yes" ] && flag="⚠️ has alpha (iOS rejects)"
  echo "$flag $proj — $dims alpha=$alpha ($(basename "$png"))"
done
