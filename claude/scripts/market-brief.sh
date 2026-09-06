#!/usr/bin/env bash
# ponytail: scans multiple outlets' YouTube channels (newest-first), keeps
# items uploaded today, ranks the combined pool by view count, prints top N
# with source tag + URL + transcript for summarizing.
set -euo pipefail

TODAY=$(date +%Y%m%d)
N="${1:-10}"

# label|channel-handle pairs. Add more outlets here (see SKILL.md).
SOURCES=(
  "WSJ|wsj"
  "Bloomberg|markets"
  "CNN|CNN"
  "FoxNews|FoxNews"
  "FoxBusiness|FoxBusiness"
  "CNBC|CNBCtelevision"
)

SEP=$'\x1f'
tmp=$(mktemp)

for src in "${SOURCES[@]}"; do
  label="${src%%|*}"
  handle="${src#*|}"
  # newest-first flat lists from both tabs; long-form videos and Shorts are
  # separate feeds on YouTube and neither tab alone has the full day's uploads
  ids=$( { yt-dlp --flat-playlist --print id --playlist-end 40 "https://www.youtube.com/@${handle}/videos"
           yt-dlp --flat-playlist --print id --playlist-end 40 "https://www.youtube.com/@${handle}/shorts"
         } 2>/dev/null | sort -u)

  for id in $ids; do
    yt-dlp --skip-download --print "%(upload_date)s${SEP}%(view_count)s${SEP}${label}${SEP}%(title)s${SEP}%(id)s" \
      "https://www.youtube.com/watch?v=$id" 2>/dev/null
  done >> "$tmp"
done

labels=""
for src in "${SOURCES[@]}"; do labels="${labels}${labels:+, }${src%%|*}"; done
echo "=== Today's ($TODAY) top market videos across $labels, ranked by views ==="
awk -F"$SEP" -v today="$TODAY" '$1==today' "$tmp" | sort -t"$SEP" -k2 -rn | head -n "$N" | \
while IFS="$SEP" read -r date views label title id; do
  echo
  echo "### [$label] $title"
  echo "Views: $views | https://youtu.be/$id"
  yt-dlp --skip-download --write-auto-sub --sub-lang en --sub-format vtt \
    -o "/tmp/market_${id}" "https://www.youtube.com/watch?v=$id" >/dev/null 2>&1 || true
  vtt="/tmp/market_${id}.en.vtt"
  if [ -f "$vtt" ]; then
    echo "--- transcript ---"
    # strip cue numbers/timestamps/inline tags, then collapse consecutive duplicate
    # lines (YouTube auto-caption vtt repeats each line as a rolling cue)
    grep -v -E '^(WEBVTT|Kind:|Language:|NOTE|[0-9]|$)' "$vtt" \
      | grep -v -- '-->' \
      | sed -E 's/<[^>]*>//g' \
      | awk '!seen[$0]++' \
      | tr '\n' ' '
    echo
    rm -f "$vtt"
  else
    echo "(no auto-captions available)"
  fi
done

rm -f "$tmp"
