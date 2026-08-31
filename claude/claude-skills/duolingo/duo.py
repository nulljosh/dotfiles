#!/usr/bin/env python3
"""Duolingo public profile stats. usage: duo.py <username> [--json]"""
import json, sys, time, urllib.request, pathlib, datetime

LOG = pathlib.Path.home() / ".claude/data/duolingo"

def fetch(username):
    req = urllib.request.Request(
        f"https://www.duolingo.com/2017-06-30/users?username={urllib.parse.quote(username)}",
        headers={"User-Agent": "Mozilla/5.0"})
    users = json.load(urllib.request.urlopen(req, timeout=20))["users"]
    if not users:
        sys.exit(f"no such user: {username}")
    return users[0]

def snapshot(u):
    sd = u.get("streakData") or {}
    cur = (sd.get("currentStreak") or {})
    return {
        "ts": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "username": u["username"], "name": u.get("name"), "id": u["id"],
        "totalXp": u.get("totalXp", 0),
        "streak": u.get("streak", 0),
        "longestStreak": (sd.get("longestStreak") or {}).get("length", 0),
        "streakStart": cur.get("startDate"), "streakEnd": cur.get("endDate"),
        "hasPlus": u.get("hasPlus"),
        "joined": datetime.date.fromtimestamp(u["creationDate"]).isoformat() if u.get("creationDate") else None,
        "activeToday": u.get("hasRecentActivity15"),
        "learning": u.get("learningLanguage"), "from": u.get("fromLanguage"),
        "location": u.get("location"), "bio": u.get("bio"),
        "achievements": len(u.get("achievements") or []),
        "courses": [{"title": c["title"], "lang": c["learningLanguage"],
                     "xp": c.get("xp", 0), "crowns": c.get("crowns", 0)}
                    for c in sorted(u.get("courses") or [], key=lambda c: -c.get("xp", 0))],
    }

def log(s):
    """Append snapshot for Lexly import; skip if identical to last (no new progress)."""
    LOG.mkdir(parents=True, exist_ok=True)
    f = LOG / f"{s['username']}.jsonl"
    if f.exists():
        last = json.loads(f.read_text().strip().split("\n")[-1])
        if all(last.get(k) == s[k] for k in ("totalXp", "streak", "courses")):
            return None
        s["deltaXp"] = s["totalXp"] - last.get("totalXp", 0)
    with f.open("a") as fh:
        fh.write(json.dumps(s) + "\n")
    return f

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("usage: duo.py <username> [--json]")
    s = snapshot(fetch(args[0]))
    f = log(s)
    if "--json" in sys.argv:
        print(json.dumps(s, indent=2)); return
    print(f"{s['name']} (@{s['username']})  {s['totalXp']:,} XP  {s['streak']}d streak "
          f"(best {s['longestStreak']}){'  PLUS' if s['hasPlus'] else ''}")
    if s.get("deltaXp"):
        print(f"since last check: +{s['deltaXp']:,} XP")
    print(f"today: {'done' if s['activeToday'] else 'NOT done'}   "
          f"joined {s['joined']}   achievements {s['achievements']}")
    for c in s["courses"]:
        print(f"  {c['title']:<12} {c['xp']:>8,} XP  {c['crowns']} crowns")
    if f: print(f"\nlogged -> {f}")

def demo():
    u = {"username": "duo", "id": 1, "totalXp": 5, "streak": 2, "courses": [],
         "streakData": {"longestStreak": {"length": 9}, "currentStreak": {}}}
    s = snapshot(u)
    assert s["longestStreak"] == 9 and s["totalXp"] == 5, s
    print("ok")

if __name__ == "__main__":
    (demo if "--demo" in sys.argv else main)()
