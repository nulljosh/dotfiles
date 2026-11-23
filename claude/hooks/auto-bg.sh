#!/bin/bash
# Auto-background long Bash calls (the ctrl+b Joshua kept pressing). No permission change: only flips run_in_background.
in=$(cat)
echo "$in" | jq -e '.tool_input.run_in_background == true' >/dev/null && exit 0
echo "$in" | jq -e '(.tool_input.timeout // 0) > 120000 or (.tool_input.command | test("xcodebuild|asc xcode (archive|export)|(^|[;&|(\\n]\\s*)(command )?sleep [0-9]|(^|[;&|\\n]\\s*)(until|while) |seq 1 [0-9]+\\); do|xcrun simctl (boot|erase)|npm (install|ci)\\b|brew (install|upgrade)"))' >/dev/null || exit 0
echo "$in" | jq '{hookSpecificOutput:{hookEventName:"PreToolUse",updatedInput:(.tool_input + {run_in_background:true})}}'
