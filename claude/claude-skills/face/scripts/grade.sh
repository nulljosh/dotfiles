#!/bin/bash
# grade.sh <N> "<grade>" "<his words>": record Joshua's grade for version N in the ledger.
L=/Volumes/LaCie/lipsync/face-versions.tsv
awk -F'\t' -v OFS='\t' -v n="$1" -v g="$2" -v w="$3" '$1==n{$5=g;$6=w}1' "$L" > "$L.tmp" && mv "$L.tmp" "$L"
awk -F"\t" -v n="$1" "\$1==n" "$L"
python3 "$(dirname "$0")/graph.py" >/dev/null
