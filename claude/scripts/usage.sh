#!/bin/bash
# Print Claude plan usage: session/weekly/model limit percentages from the OAuth usage endpoint.
# Exits 0 with output like: session 8% (resets 22:49) | weekly_all 50% | weekly_scoped[Fable] 83% WARNING
# Exits 1 silently on any failure — callers should treat usage as unknown, not block.
set -o pipefail
TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null \
  | jq -r '.claudeAiOauth.accessToken // empty') || exit 1
[ -n "$TOKEN" ] || exit 1
curl -sf --max-time 10 https://api.anthropic.com/api/oauth/usage \
  -H "Authorization: Bearer $TOKEN" -H "anthropic-beta: oauth-2025-04-20" \
| jq -r '
  def reset: if .resets_at then " (resets " + (.resets_at[0:19] + "Z" | fromdate | strflocaltime("%a %H:%M")) + ")" else "" end;
  [.limits[] | "\(.kind)\(if .scope.model.display_name then "[" + .scope.model.display_name + "]" else "" end) \(.percent)%\(reset)\(if .severity != "normal" then " " + (.severity | ascii_upcase) else "" end)"]
  | join(" | ")'
