import json, os, collections
p = os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/Documents/School/math/Raw/captures/log.jsonl")
if not os.path.exists(p):
    print("No quiz recorded yet."); raise SystemExit
by = collections.OrderedDict()
for line in open(p):
    try: e = json.loads(line)
    except ValueError: continue
    by.setdefault(e.get("title", "?"), []).append(e)
for title, es in reversed(list(by.items())):
    print(f"## {title}")
    for e in es:
        if e.get("kind") == "submit":
            print(f"  {e['ts'][:16]} {e.get('button','submit')}:\n    " + (e.get("answers") or "(nothing picked)").replace("\n", "\n    "))
        elif "MY current answers" in e.get("prompt", ""):
            print(f"  {e['ts'][:16]} coach: {e.get('reply','')[:600]}")
    print()
