#!/usr/bin/env bash
# Non-destructive App Store name availability probe.
# Renames a throwaway app record to each candidate, reads Apple's verdict, restores the name.
# Usage: ./probe.sh Foo Bar Baz     [ASC_PROBE_APP=<id> to override the throwaway record]
set -uo pipefail

APP="${ASC_PROBE_APP:-6783501927}"   # Lexly Mac — duplicate record, REJECTED, slated for deletion
[ $# -gt 0 ] || { echo "usage: $0 <name> [name...]" >&2; exit 2; }

# Guard: never probe against a record that is live or in front of a reviewer.
STATES=$(asc versions list --app "$APP" --output json | python3 -c \
  'import json,sys;print(" ".join(v["attributes"]["appStoreState"] for v in json.load(sys.stdin)["data"]))')
for s in READY_FOR_SALE PENDING_DEVELOPER_RELEASE IN_REVIEW WAITING_FOR_REVIEW PENDING_APPLE_RELEASE; do
  case " $STATES " in *" $s "*) echo "refusing: app $APP has a version in $s" >&2; exit 1;; esac
done

ORIGINAL=$(asc apps view --id "$APP" --output json | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["attributes"]["name"])')
[ -n "$ORIGINAL" ] || { echo "could not read current name of $APP" >&2; exit 1; }

# ponytail: the trap is the one thing here that must not be simplified away —
# without it a Ctrl-C leaves the record named after some candidate.
current_name() { asc apps view --id "$APP" --output json | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["attributes"]["name"])'; }
restore() {
  for _ in 1 2 3; do
    asc apps rename --app "$APP" --locale en-US --name "$ORIGINAL" >/dev/null 2>&1
    sleep 1
    [ "$(current_name)" = "$ORIGINAL" ] && return 0
  done
  echo "WARNING: could not restore $APP to \"$ORIGINAL\" — rename it back manually" >&2
}
trap restore EXIT

for name in "$@"; do
  out=$(asc apps rename --app "$APP" --locale en-US --name "$name" --output json 2>&1)
  case "$out" in
    *DUPLICATE*|*"already being used"*|*"already been used"*) echo "$name  TAKEN" ;;
    *'"name"'*)  echo "$name  AVAILABLE" ;;
    *)           echo "$name  ERROR: $out" >&2; exit 1 ;;
  esac
done
