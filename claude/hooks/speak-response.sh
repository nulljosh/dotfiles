#!/bin/bash
# Speaks Claude's final reply out loud via macOS `say`, so responses can be
# heard through headphones without staring at the terminal, matching what
# already exists on iOS Claude Code. Reads transcript_path from the Stop
# hook's JSON payload on stdin, pulls the last assistant text block out of
# that session's JSONL transcript, strips code fences/URLs (unreadable out
# loud, `say` just spells them out letter by letter) and caps length so a
# long response doesn't turn into a two-minute monologue.
# ponytail: global "one voice at a time" via killing any prior `say`, no
# queueing/config beyond that, add if it's ever actually needed.

payload=$(cat)
transcript=$(echo "$payload" | python3 -c "import json,sys; print(json.load(sys.stdin).get('transcript_path',''))" 2>/dev/null)
[ -z "$transcript" ] || [ ! -f "$transcript" ] && exit 0

text=$(python3 - "$transcript" <<'EOF'
import json, sys
path = sys.argv[1]
last = None
with open(path, 'r') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        if entry.get('type') != 'assistant':
            continue
        msg = entry.get('message', {})
        for block in msg.get('content', []) or []:
            if isinstance(block, dict) and block.get('type') == 'text' and block.get('text', '').strip():
                last = block['text']
if last:
    print(last)
EOF
)
[ -z "$text" ] && exit 0

# Strip markdown/code noise `say` can't read sensibly, then keep only the
# first sentence or two: reported as "kinda weird" reading full replies
# verbatim, this is a spoken TLDR, not a transcript. Samantha at a slower
# rate reads as a calm heads-up, not the default voice's clipped, flat
# cadence, which is the "subdued" ask.
clean=$(echo "$text" \
  | sed -E 's/```[a-zA-Z]*//g; s/`([^`]*)`/\1/g' \
  | sed -E 's#https?://[^ ]+#a link#g' \
  | tr -s '\n' ' ')
clean=$(echo "$clean" | python3 -c "
import sys, re
t = sys.stdin.read().strip()
t = t[:220]
m = re.search(r'^.{0,180}?[.!?](?=\s|$)', t)
print(m.group(0) if m else t[:120])
")

[ -z "$clean" ] && exit 0
pkill say 2>/dev/null
say -v Samantha -r 165 "$clean" &
exit 0
