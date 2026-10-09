#!/bin/bash
# Bulk domain availability signal for brand/company naming.
# Usage: domains.sh name1 name2 ...      (or names on stdin, one per line)
#        TLDS="computer systems" domains.sh name ...   also checks those TLDs
#        ALL=1 domains.sh ...            print taken/unknown too, not just FREE
# .com uses whois and only calls a name FREE on an explicit "No match for";
# anything else is taken or unknown, so a rate-limited whois never reads as free.
# Other TLDs use "no NS records" as the signal, which is weaker.
# A signal only: confirm at a registrar and run a trademark search before buying.
check() {
  n=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')
  [ -z "$n" ] && return
  o=$(whois "$n.com" 2>/dev/null)
  if echo "$o" | grep -qi "No match for"; then echo "FREE    $n.com"
  elif echo "$o" | grep -qiE "^ *domain name:"; then [ -n "$ALL" ] && echo "taken   $n.com"
  else [ -n "$ALL" ] && echo "unknown $n.com"; fi
  for t in $TLDS; do
    ns=$(dig +short NS "$n.$t" | head -1)
    if [ -z "$ns" ]; then echo "FREE?   $n.$t"; elif [ -n "$ALL" ]; then echo "taken   $n.$t"; fi
  done
}
export -f check; export TLDS ALL
if [ $# -gt 0 ]; then printf '%s\n' "$@"; else cat; fi | xargs -P 5 -I{} bash -c 'check {}' | sort
