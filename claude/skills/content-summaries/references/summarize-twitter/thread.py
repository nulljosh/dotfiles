#!/usr/bin/env python3
"""Print a tweet or its whole thread as plain text. Usage: thread.py <tweet url or id>
Walks UP the reply chain via api.fxtwitter.com (no key), stops when the author changes.
ponytail: fxtwitter has no children endpoint, so paste the LAST tweet of a thread to get all of it;
given the first tweet you only get that one. Chrome fallback for the rest."""
import json, re, sys, urllib.request

def fetch(tid):
    req = urllib.request.Request(f"https://api.fxtwitter.com/i/status/{tid}", headers={"User-Agent": "Mozilla/5.0"})
    return json.load(urllib.request.urlopen(req, timeout=20)).get("tweet")

def thread(tid):
    out, author = [], None
    while tid:
        t = fetch(tid)
        if not t or (author and t["author"]["screen_name"] != author):
            break
        author = t["author"]["screen_name"]
        media = " ".join(m.get("url", "") for m in (t.get("media") or {}).get("all", []))
        q = t.get("quote")
        quote = f'\n  > @{q["author"]["screen_name"]}: {q["text"]}' if q else ""
        out.append(f'@{author} ({t["created_at"]}): {t["text"]}{quote}{(" [media: " + media + "]") if media else ""}')
        tid = t.get("replying_to_status")
    return list(reversed(out))

if __name__ == "__main__":
    m = re.search(r"(\d{8,})", sys.argv[1] if len(sys.argv) > 1 else "")
    if not m:
        sys.exit("usage: thread.py <tweet url or id>")
    lines = thread(m.group(1))
    assert lines, "no tweet found"
    print(f"{len(lines)} tweet(s)\n")
    print("\n\n".join(lines))
