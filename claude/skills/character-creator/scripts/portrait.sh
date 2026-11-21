#!/bin/bash
# portrait.sh <out-dir> <prompt>  ->  <out-dir>/portrait.png + portrait.url (public CDN link, feeds loop.sh)
# Higgsfield Soul v2, a few cents. Key: HIGGSFIELD_API_KEY ("id:secret") in ~/.config/fish/secrets.fish.
set -e
out=$1; mkdir -p "$out"
K=$(grep HIGGSFIELD_API_KEY ~/.config/fish/secrets.fish | sed "s/.*'\(.*\)'/\1/")
body=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$2")
id=$(curl -s -X POST https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard -H "Authorization: Key $K" \
  -H "Content-Type: application/json" -d "$body" | python3 -c "import json,sys; print(json.load(sys.stdin)['request_id'])")
for i in $(seq 1 60); do
  s=$(curl -s "https://api.higgsfield.ai/requests/$id/status" -H "Authorization: Key $K")
  st=$(echo "$s" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status'))")
  case $st in completed|failed|nsfw|canceled) break;; esac; sleep 3
done
[ "$st" = completed ] || { echo "portrait $st"; exit 1; }
u=$(echo "$s" | python3 -c "import json,sys; print(json.load(sys.stdin)['images'][0]['url'])")
echo "$u" > "$out/portrait.url"; curl -sL -o "$out/portrait.png" "$u"; echo "portrait ok: $out/portrait.png"
"$(dirname "$0")/spend.sh" add -0.05 "portrait"; "$(dirname "$0")/spend.sh"
