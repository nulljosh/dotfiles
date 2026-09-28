#!/bin/bash
# iterate.sh <N> "<what changed>": render vN, bench vs the real clip and vN-1, sheet, ledger.
set -e
N=$1; WHAT=$2; L=/Volumes/LaCie/lipsync; JT=${JT:-/tmp/jt-v12}
[ -d "$JT/tools/gen" ] || JT=~/Documents/Code/joshuatree
cd "$L"
BLINK_CLIP=$L/char16/talk.mp4 UV_CACHE_DIR=$L/uvcache uv run -q --with numpy --with pillow --with opencv-python-headless \
  "$JT/tools/gen/face_visemes.py" char18/talk.mp4 test-align.json test.wav "samantha-v$N.mp4"
prev=$(ls samantha-v$((N-1)).mp4 2>/dev/null || true)
out=$(uv run -q --with numpy --with pillow "$JT/tools/bench/face_bench.py" real-close.mp4 $prev "samantha-v$N.mp4")
echo "$out"
ffmpeg -v error -y -i "samantha-v$N.mp4" -vf "fps=6,crop=220:220:50:40,scale=120:-1,tile=12x3" -frames:v 1 "v$N-sheet.png"
total=$(echo "$out" | tail -1 | awk '{print $(NF-1), $NF}')
[ -f face-versions.tsv ] || printf 'version\tdate\tchange\tbench\tgrade\tjoshua\n' > face-versions.tsv
printf '%s\t%s\t%s\t%s\t\t\n' "$N" "$(date +%F)" "$WHAT" "$total" >> face-versions.tsv
echo "sheet: $L/v$N-sheet.png  video: $L/samantha-v$N.mp4"
