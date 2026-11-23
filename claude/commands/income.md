---
description: All-time App Store downloads and proceeds across every app, via the asc web session
---

Run this in the background (it takes a few minutes for ~30 apps), then reply with the grand total proceeds,
total downloads, and only the apps that earned money. TLDR. Note Apple data trails 1-2 days.

```bash
d=$(mktemp -d /private/tmp/claude-501/income.XXXX) && cd $d && end=$(date -v-1d +%Y-%m-%d) && \
for id in $(asc apps list --output json | python3 -c "import json,sys;[print(a['id']) for a in json.load(sys.stdin)['data']]"); do
  asc web analytics overview --app $id --start 2025-06-01 --end $end --output json > ov_$id.json 2>&1
done; python3 - <<'E'
import json,glob
tot={}
for f in glob.glob('ov_*.json'):
    try: d=json.load(open(f))
    except Exception: print('ERR',f,open(f).read()[:200]); continue
    m={x['measure']:x.get('total') for sec in d.values() if isinstance(sec,list) for x in sec if isinstance(x,dict) and 'measure' in x}
    print(f[3:-5], m.get('units'), m.get('proceeds'), m.get('payingUsers'))
    for k in ('units','proceeds'): tot[k]=tot.get(k,0)+(m.get(k) or 0)
print('TOTAL',tot)
E
```

If the web session needs 2FA, follow [[reference_asc_auto_2fa]] in memory. The API sales route (`asc analytics sales`)
needs the issuer ID, which is not in `~/.asc/config.json`, so skip it.
