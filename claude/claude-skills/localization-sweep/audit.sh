#!/bin/bash
# ponytail: heuristic grep-based detection, not a real AST/string-extractor — eyeball the flagged lines
cd ~/Documents/Code || exit 1

for master in $(find . -maxdepth 3 -path "*/i18n/strings.json" -not -path "*/node_modules/*" 2>/dev/null); do
  proj_dir=$(dirname "$(dirname "$master")")
  proj=${proj_dir#./}
  keys=$(python3 -c "import json; d=json.load(open('$master')); print(len([k for k in d if k!='_meta']))")
  locales=$(python3 -c "import json; d=json.load(open('$master')); print(','.join(d['_meta']['locales']))" 2>/dev/null)
  echo "=== $proj — master: $keys keys, locales: $locales ==="

  # web: literals never retrofitted to t()/I18N.t()
  web_wired=$(grep -rlE "I18N\.t\(|[^a-zA-Z]t\(['\"]" "$proj_dir"/web 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
  echo "  web files calling t()/I18N.t(): $web_wired"

  # ios: Text("literal") / Button("literal") not using String(localized:)/LocalizedStringKey with catalog keys
  if [ -d "$proj_dir/ios" ]; then
    swift_literals=$(grep -rEo --include='*.swift' 'Text\("[^"]*"\)|Button\("[^"]*"' "$proj_dir/ios" 2>/dev/null | wc -l | tr -d ' ')
    swift_wired=$(grep -rlE --include='*.swift' 'String\(localized:|LocalizedStringResource' "$proj_dir/ios" 2>/dev/null | wc -l | tr -d ' ')
    echo "  ios: $swift_literals literal Text()/Button() calls, $swift_wired files using String(localized:)"
    if [ "$swift_wired" = "0" ] && [ "$swift_literals" -gt 0 ]; then
      echo "  ⚠️  catalog exists but no Swift call site references it — UI is still hardcoded English"
    fi
  fi
  echo
done

# projects with NO i18n pipeline at all but multiple user-facing text files (candidates for a first pass)
echo "=== projects with no i18n/strings.json master (not yet localized) ==="
for d in */; do
  d=${d%/}
  [ -d "$d/.git" ] || continue
  [ -f "$d/i18n/strings.json" ] && continue
  has_ui=$(find "$d" -maxdepth 3 \( -iname "*.swift" -o -iname "*.html" \) -not -path "*/node_modules/*" 2>/dev/null | grep -v Tests | wc -l | tr -d ' ')
  [ "$has_ui" -gt 0 ] && echo "  $d ($has_ui UI files)"
done
