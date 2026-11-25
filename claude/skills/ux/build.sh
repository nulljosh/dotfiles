#!/bin/bash
# Build every iOS and macOS app project under <app-dir> without signing. Prints one line per project.
# usage: build.sh <app-dir>   (exit 1 if any build fails)
dd="${TMPDIR:-/tmp}/ux-dd"; fail=0
while IFS= read -r proj; do
  schemes=$(xcodebuild -list -json -project "$proj" 2>/dev/null | python3 -c 'import json,sys,re
d=json.load(sys.stdin); s=(d.get("project") or {}).get("schemes",[])
print("\n".join(x for x in s if not re.search(r"Widget|Tests|Watch|Extension|Intents|Clip|Keyboard|Share|Notification|-Package|Package$|Snapshots|UITests|[Ww]atch",x)))')
  [ -z "$schemes" ] && { echo "SKIP $proj (no app scheme)"; continue; }
  while IFS= read -r scheme; do
    # try iOS Simulator, then macOS: the scheme tells us which it supports by refusing the other
    for dest in 'generic/platform=iOS Simulator' 'generic/platform=macOS'; do
      out=$(xcodebuild -project "$proj" -scheme "$scheme" -destination "$dest" -derivedDataPath "$dd" build CODE_SIGNING_ALLOWED=NO 2>&1)
      grep -q "supported platforms\|Unable to find a destination" <<<"$out" || break
    done
    if grep -q 'BUILD SUCCEEDED' <<<"$out"; then echo "OK   $proj [$scheme]"
    else echo "FAIL $proj [$scheme]"; grep -E ' error:' <<<"$out" | sort -u | head -8; fail=1; fi
    rm -rf "$dd"
  done <<<"$schemes"
done < <(find "$1" -maxdepth 3 -name '*.xcodeproj' -not -path '*/Pods/*' -not -path '*/node_modules/*' | grep -viE 'watch|widget|tvos|visionos')
exit $fail
