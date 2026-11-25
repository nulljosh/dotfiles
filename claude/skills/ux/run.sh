#!/bin/bash
# Batch /ux: for each app folder, fix -> build -> commit only the files fix changed. Reverts an app whose build fails.
# usage: run.sh app1 app2 ...   (from ~/Documents/Code)
here=$(cd "$(dirname "$0")" && pwd)
for app in "$@"; do
  [ -d "$app" ] || { echo "## $app: no folder"; continue; }
  before=$(git -C "$app" diff --name-only --relative | sort)
  report=$(python3 "$here/fix.py" "$app")
  changed=$(comm -13 <(echo "$before") <(git -C "$app" diff --name-only --relative | sort) | grep . )
  echo "## $app: $(head -1 <<<"$report")"
  tail -n +2 <<<"$report"
  [ -z "$changed" ] && { echo "   nothing to commit"; continue; }
  if "$here/build.sh" "$app"; then
    (cd "$app" && git commit -q -m "Accessibility: Dynamic Type text styles and VoiceOver labels on icon-only buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015joN7tHXRhezH5MAk5aTMc" -- $changed && echo "   committed $(git log --oneline -1)")
  else
    (cd "$app" && git checkout -- $changed) && echo "   BUILD FAILED, reverted"
  fi
done
