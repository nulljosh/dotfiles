#!/bin/bash
# spend.sh                     -> Higgsfield balance: last known balance minus renders since
# spend.sh set <dollars>       -> record the balance read off the dashboard (calibrates)
# spend.sh add <dollars> <note> -> log a render (loop.sh and portrait.sh call this)
# spend.sh app                  -> the app account's live credits and recent charges (official `higgsfield` CLI)
# spend.sh cost <model> [flags] -> free price quote for a render before running it
# The developer API (cloud.higgsfield.ai, the key in secrets.fish) has no balance API, so this ledger is the running count. Positive = money in.
L=~/.samantha/higgsfield-ledger.tsv
mkdir -p ~/.samantha; touch "$L"
case $1 in
  set) printf '%s\tset\t%s\tdashboard reading\n' "$(date +%F\ %H:%M)" "$2" >> "$L";;
  add) printf '%s\tadd\t%s\t%s\n' "$(date +%F\ %H:%M)" "$2" "$3" >> "$L";;
  app) higgsfield account status | sed 's/^[^ ]* — //'; higgsfield account transactions --size 5;;
  cost) shift; higgsfield generate cost "$@";;
  *) awk -F'\t' '$2=="set"{b=$3; since=0; n=0; s=$1} $2=="add"{b+=$3; since+=$3; n++}
         END{ if (s=="") { printf "no dashboard reading yet: spend.sh set <dollars>\n"; exit }
              printf "Higgsfield: $%.2f left (dashboard %s, %d renders since, $%.2f)\n", b, s, n, -since }' "$L";;
esac
