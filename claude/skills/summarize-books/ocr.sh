#!/bin/sh
# OCR one page photo to text. Tries all four rotations (phone photos are often sideways or
# upside down) and keeps the one with the most common English words.
# Usage: ocr.sh page.heic out.txt   (needs ImageMagick `magick` and `tesseract`)
f="$1"; out="$2"; best=0; d=$(mktemp -d)
for r in 0 90 180 270; do
  magick "$f" -rotate $r "$d/r.jpg"; tesseract "$d/r.jpg" "$d/t$r" >/dev/null 2>&1
  n=$(grep -o -i -w -E "the|and|to|of|a|is|in|that|for|it|with|as" "$d/t$r.txt" | wc -l | tr -d ' ')
  [ "$n" -gt "$best" ] && best=$n && cp "$d/t$r.txt" "$out"
done; rm -rf "$d"; echo "$(basename "$f") $best"
