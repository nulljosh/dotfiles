#!/bin/bash
# lipsync.sh <character-dir> [line.wav]
# Free lip sync: her portrait (eyes open, slow camera drift) + her voice ->
# <dir>/talk.mp4 whose mouth shapes the actual words. Runs LatentSync on
# Hugging Face's free GPUs (fffiloni/LatentSync). Needs a free HF read token
# in HF_TOKEN (anonymous quota is too small for one render). Nothing heavy
# runs on the Mac, so it never swaps.
set -e
dir=$1; wav=${2:-$dir/visemes.wav}
[ -f "$dir/portrait.png" ] && [ -f "$wav" ] || { echo "usage: lipsync.sh <character-dir> [line.wav]"; exit 1; }
[ -n "$HF_TOKEN" ] || HF_TOKEN=$(grep HF_TOKEN ~/.config/fish/secrets.fish | sed "s/.*'\(.*\)'/\1/")
secs=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$wav")
work=$(mktemp -d)
# Base video: the still portrait with a gentle zoom and bob, so eyes stay open.
# Don't use idle.mp4 as the base: video-model loops blink a lot, and the
# frame cutter then picks an eyes-closed stretch as the "steadiest".
ffmpeg -v error -y -loop 1 -i "$dir/portrait.png" -t "$secs" -r 25 \
  -vf "scale=1024:1024,zoompan=z='1.04+0.01*sin(2*PI*on/250)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+4*sin(2*PI*on/125)':d=1:s=512x512:fps=25" \
  -pix_fmt yuv420p "$work/base.mp4"
HF_TOKEN=$HF_TOKEN uv run -q --with gradio_client python3 - "$work/base.mp4" "$wav" "$dir/talk.mp4" <<'PY'
import os, shutil, sys
from gradio_client import Client, handle_file
c = Client("fffiloni/LatentSync", token=os.environ["HF_TOKEN"], verbose=False)
r = c.predict(input_video_path=handle_file(sys.argv[1]), input_audio_path=handle_file(sys.argv[2]),
              api_name="/generate_lip_sync_video")
shutil.copy(r["video"] if isinstance(r, dict) else r, sys.argv[3])
print("lipsync ok:", sys.argv[3])
PY
rm -rf "$work"
