#!/bin/bash
# Lists every note in Apple Notes (default "Notes" folder, or $1) as one plaintext
# file per note in a tmp dir: line 1 = note name, rest = note plaintext.
# ponytail: reads `plaintext of note` directly — no HTML/PDF/Chrome hop.
set -euo pipefail

FOLDER="${1:-Notes}"
OUTDIR="${2:-$(mktemp -d /tmp/notes_ingest_XXXX)}"
mkdir -p "$OUTDIR"

/usr/bin/osascript <<APPLESCRIPT > /tmp/notes_ingest_manifest.tsv
tell application "Notes"
  set out to ""
  repeat with n in notes of folder "$FOLDER"
    set out to out & (id of n) & linefeed
  end repeat
  return out
end tell
APPLESCRIPT

while IFS= read -r noteId; do
  [[ -z "$noteId" ]] && continue
  safeId=$(echo "$noteId" | tr -c 'A-Za-z0-9' '_')
  # ponytail: one bad note (locked, attachment-only) must not kill the run
  name=$(/usr/bin/osascript -e "tell application \"Notes\" to get name of note id \"$noteId\"" 2>/dev/null) || {
    echo "skip (unreadable name): $noteId" >&2; continue
  }
  body=$(/usr/bin/osascript -e "tell application \"Notes\" to get plaintext of note id \"$noteId\"" 2>/dev/null) || {
    echo "skip (unreadable body): $name" >&2; continue
  }
  { echo "$name"; echo "$body"; } > "$OUTDIR/$safeId.txt"
  echo "$OUTDIR/$safeId.txt	$noteId"
done < /tmp/notes_ingest_manifest.tsv
