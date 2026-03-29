#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p assets/css assets/js assets/img pages notes

move_file() {
  local src="$1"
  local dst="$2"
  if [[ -f "$src" ]]; then
    mv "$src" "$dst"
  fi
}

# Move markdown notes into notes/
move_file "health.md" "notes/health.md"
move_file "pixelmator.md" "notes/pixelmator.md"
move_file "school.md" "notes/school.md"
move_file "tally.md" "notes/tally.md"
move_file "timeline.md" "notes/timeline.md"

# Move note pages into pages/
move_file "CLAUDE.html" "pages/CLAUDE.html"
move_file "health.html" "pages/health.html"
move_file "pixelmator.html" "pages/pixelmator.html"
move_file "school.html" "pages/school.html"
move_file "tally.html" "pages/tally.html"
move_file "timeline.html" "pages/timeline.html"

# Move shared assets
move_file "note-page.css" "assets/css/note-page.css"
move_file "note-page.js" "assets/js/note-page.js"
move_file "theme-toggle.js" "assets/js/theme-toggle.js"
move_file "icon.svg" "assets/img/icon.svg"
move_file "architecture.svg" "assets/img/architecture.svg"

# Update root index paths
if [[ -f "index.html" ]]; then
  perl -0pi -e 's/href="CLAUDE\.html"/href="pages\/CLAUDE.html"/g;
                s/href="health\.html"/href="pages\/health.html"/g;
                s/href="pixelmator\.html"/href="pages\/pixelmator.html"/g;
                s/href="school\.html"/href="pages\/school.html"/g;
                s/href="tally\.html"/href="pages\/tally.html"/g;
                s/href="timeline\.html"/href="pages\/timeline.html"/g;
                s#<script src="theme-toggle\.js"></script>#<script src="assets/js/theme-toggle.js"></script>#g' index.html
fi

# Update note pages to new relative paths
for page in pages/*.html; do
  [[ -f "$page" ]] || continue
  perl -0pi -e 's#href="note-page\.css"#href="../assets/css/note-page.css"#g;
                s#href="index\.html"#href="../index.html"#g;
                s#<script src="theme-toggle\.js"></script>#<script src="../assets/js/theme-toggle.js"></script>#g;
                s#<script src="note-page\.js"></script>#<script src="../assets/js/note-page.js"></script>#g;
                s/data-file="(?!\.\.\/notes\/)([^"]+\.md)"/data-file="..\/notes\/$1"/g' "$page"
done

# CLAUDE.md remains at repo root.
if [[ -f "pages/CLAUDE.html" ]]; then
  perl -0pi -e 's#data-file="\.\./notes/CLAUDE\.md"#data-file="../CLAUDE.md"#g' pages/CLAUDE.html
fi

# Update docs asset paths
if [[ -f "README.md" ]]; then
  perl -0pi -e 's/src="icon\.svg"/src="assets\/img\/icon.svg"/g;
                s/\]\(architecture\.svg\)/](assets\/img\/architecture.svg)/g' README.md
fi

echo "Simplify complete: organized files into pages/, notes/, and assets/."
