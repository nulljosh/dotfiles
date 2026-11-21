#!/bin/bash
# speak.sh <out-dir> <audio-url> "<prompt>" [duration-seconds]
# Higgsfield lip-sync render: image_url (from <out-dir>/portrait.url) + audio_url + prompt -> <out-dir>/visemes.mp4
# Paid job: about $0.14 a second of audio. Logs spend via spend.sh.
set -e
out=$1; audio_url=$2; prompt=$3; secs_arg=$4
[ -n "$out" ] && [ -n "$audio_url" ] && [ -n "$prompt" ] || { echo "usage: speak.sh <out-dir> <audio-url> \"<prompt>\" [duration-seconds]"; exit 1; }
K=$(grep HIGGSFIELD_API_KEY ~/.config/fish/secrets.fish | sed "s/.*'\(.*\)'/\1/")

# Duration for cost logging: prefer a local copy of the audio via ffprobe, else the 4th arg.
secs=""
local_audio="$out/visemes.mp3"
if [ -f "$local_audio" ] && command -v ffprobe >/dev/null 2>&1; then
  secs=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$local_audio" 2>/dev/null || true)
fi
[ -n "$secs" ] || secs=$secs_arg
[ -n "$secs" ] || { echo "could not determine duration: no local $local_audio and no duration arg given"; exit 1; }

image_url=$(cat "$out/portrait.url")

body=$(python3 -c 'import json,sys; print(json.dumps({"image_url": sys.argv[1], "audio_url": sys.argv[2], "prompt": sys.argv[3]}))' "$image_url" "$audio_url" "$prompt")
r=$(curl -s -X POST https://api.higgsfield.ai/higgsfield-ai/speak -H "Authorization: Key $K" -H "Content-Type: application/json" -d "$body")
id=$(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('request_id') or '')")
[ -n "$id" ] || { echo "submit failed: $r"; exit 1; }

for i in $(seq 1 120); do
  s=$(curl -s "https://api.higgsfield.ai/requests/$id/status" -H "Authorization: Key $K")
  st=$(echo "$s" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status'))")
  case $st in completed|failed|nsfw|canceled) break;; esac; sleep 8
done
[ "$st" = completed ] || { echo "speak $st: $(echo "$s" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error') or d.get('detail') or d)")"; exit 1; }

u=$(echo "$s" | python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('video') or {}).get('url') or d['videos'][0]['url'])")
curl -sL -o "$out/visemes.mp4" "$u"; echo "speak ok: $out/visemes.mp4"

"$(dirname "$0")/spend.sh" add "-$(python3 -c "print(round(0.14*$secs,2))")" "speak ${secs}s"; "$(dirname "$0")/spend.sh"
