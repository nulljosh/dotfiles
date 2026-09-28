#!/bin/bash
# loop.sh <out-dir> <idle|listen|talk> [seconds=5]  ->  <out-dir>/<kind>.mp4
# Seedance 2.5 reference-to-video at 480p from <out-dir>/portrait.url. About $0.14 a second.
set -e
out=$1; kind=$2; secs=${3:-5}
K=$(grep HIGGSFIELD_API_KEY ~/.config/fish/secrets.fish | sed "s/.*'\(.*\)'/\1/")
case $kind in
  idle)   p="The same woman, same framing, camera locked off. She sits still and relaxed, breathes softly, blinks naturally, a faint warm smile. Mouth closed. Minimal movement so the clip loops cleanly.";;
  listen) p="The same woman, same framing, camera locked off. She listens attentively to someone off camera, small slow nods, eyebrows lift a little, mouth closed. Minimal movement so the clip loops cleanly.";;
  talk)   p="The same woman, same framing, camera locked off. She talks warmly and naturally to the camera, lips and jaw moving as she speaks, small natural head movements, friendly expression. Minimal background change.";;
  *) echo "kind must be idle, listen or talk"; exit 1;;
esac
body=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1], "image_urls": [sys.argv[2]], "duration": int(sys.argv[3]), "resolution": "480p"}))' "$p" "$(cat "$out/portrait.url")" "$secs")
r=$(curl -s -X POST https://api.higgsfield.ai/bytedance/seedance-2.5/reference-to-video -H "Authorization: Key $K" -H "Content-Type: application/json" -d "$body")
id=$(echo "$r" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('request_id') or '')")
[ -n "$id" ] || { echo "submit failed: $r"; exit 1; }
for i in $(seq 1 120); do
  s=$(curl -s "https://api.higgsfield.ai/requests/$id/status" -H "Authorization: Key $K")
  st=$(echo "$s" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status'))")
  case $st in completed|failed|nsfw|canceled) break;; esac; sleep 8
done
[ "$st" = completed ] || { echo "$kind $st: $(echo "$s" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error') or d.get('detail') or d)")"; exit 1; }
u=$(echo "$s" | python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('video') or {}).get('url') or d['videos'][0]['url'])")
curl -sL -o "$out/$kind.mp4" "$u"; echo "$kind ok: $out/$kind.mp4"
"$(dirname "$0")/spend.sh" add "-$(python3 -c "print(round(0.14*$secs,2))")" "$kind loop ${secs}s"; "$(dirname "$0")/spend.sh"
