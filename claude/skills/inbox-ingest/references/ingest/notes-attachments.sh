#!/bin/bash
# Exports every image/file attachment of active notes to OUT_DIR as <note pk>-<n>.<ext> (images
# resized to PNG, other files copied as-is). Rerun-safe: wipes its own <pk>-* files first.
# Prints "<note pk>\t<title>\t<path>" per file so the caller can Read each image and file its content.
# ponytail: AppleScript `save attachment` fails (Notes is sandboxed), so read NoteStore.sqlite
# read-only and copy from the Media folder directly. Link attachments (web previews) have no
# file; get those with: tell application "Notes" to get URL of attachment 1 of note "<title>"
set -euo pipefail
OUT="${1:?usage: notes-attachments.sh OUT_DIR}"; mkdir -p "$OUT"
G="$HOME/Library/Group Containers/group.com.apple.notes"
seen=""
sqlite3 -readonly -separator $'\t' "$G/NoteStore.sqlite" "
  select n.Z_PK, n.ZTITLE1, m.ZIDENTIFIER, m.ZFILENAME
  from ZICCLOUDSYNCINGOBJECT a
  join ZICCLOUDSYNCINGOBJECT m on a.ZMEDIA = m.Z_PK
  join ZICCLOUDSYNCINGOBJECT n on a.ZNOTE = n.Z_PK
  join ZICCLOUDSYNCINGOBJECT fo on n.ZFOLDER = fo.Z_PK
  where coalesce(n.ZMARKEDFORDELETION, 0) = 0 and coalesce(fo.ZFOLDERTYPE, 0) != 1;" |
while IFS=$'\t' read -r pk title media file; do
  src=$(find "$G/Accounts" -path "*/Media/$media/*" -type f -name "$file" -print -quit)
  [[ -z "$src" ]] && { echo "MISSING (not downloaded from iCloud?): $title / $file" >&2; continue; }
  [[ " $seen " == *" $pk "* ]] || { rm -f "$OUT/$pk"-*; seen="$seen $pk"; }
  n=1; while compgen -G "$OUT/$pk-$n.*" >/dev/null; do n=$((n+1)); done
  dst="$OUT/$pk-$n.png"
  # ponytail: PDFs/audio aren't images; keep the original instead of aborting the loop
  sips -s format png -Z 1600 "$src" --out "$dst" >/dev/null 2>&1 || { dst="$OUT/$pk-$n.${file##*.}"; cp "$src" "$dst"; }
  printf '%s\t%s\t%s\n' "$pk" "$title" "$dst"
done
