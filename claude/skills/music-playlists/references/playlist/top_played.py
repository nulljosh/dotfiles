#!/usr/bin/env python3
"""Build a "Top N (D days)" playlist in Music.app, print the tracklist as "Artist - Title".

usage: top_played.py [count=50] [days=30]
"""
import subprocess
import sys

FS, GS = "\x1e", "\x1d"  # item and list separators, safe against commas in titles

FETCH = """
on run argv
  set d to (item 1 of argv) as integer
  tell application "Music"
    set cutoff to (current date) - (d * days)
    set out to {persistent ID of (every track of library playlist 1 whose played date > cutoff), ¬
      played count of (every track of library playlist 1 whose played date > cutoff), ¬
      artist of (every track of library playlist 1 whose played date > cutoff), ¬
      name of (every track of library playlist 1 whose played date > cutoff)}
  end tell
  set parts to {}
  set AppleScript's text item delimiters to (ASCII character 30)
  repeat with l in out
    set end of parts to ((contents of l) as text)
  end repeat
  set AppleScript's text item delimiters to (ASCII character 29)
  return parts as text
end run
"""

BUILD = """
on run argv
  set plName to item 1 of argv
  tell application "Music"
    if exists user playlist plName then
      try
        delete every track of user playlist plName
      end try
    else
      make new user playlist with properties {name:plName}
    end if
    repeat with i from 2 to count of argv
      duplicate (first track of library playlist 1 whose persistent ID is (item i of argv)) to user playlist plName
    end repeat
  end tell
end run
"""


def osa(script, *args):
    r = subprocess.run(["osascript", "-e", script, *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"Music.app said no: {r.stderr.strip()}")
    return r.stdout.rstrip("\n")


def rank(raw, n):
    """raw osascript dump -> top n (id, plays, artist, title), most played first."""
    ids, plays, artists, names = (part.split(FS) for part in raw.split(GS))
    rows = zip(ids, (int(p or 0) for p in plays), artists, names)
    return sorted(rows, key=lambda r: -r[1])[:n]


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    # ponytail: Music.app keeps a total play count and a last-played date, no per-day
    # history. So this is "played in the window, ranked by all-time plays". True
    # 30-day counts need daily snapshots of the library, add that if the ranking feels off.
    top = rank(osa(FETCH, str(days)), n)
    name = f"Top {n} ({days} days)"
    osa(BUILD, name, *(r[0] for r in top))
    print(f"# {name}: {len(top)} tracks", file=sys.stderr)
    for _, _, artist, title in top:
        print(f"{artist} - {title}")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        raw = GS.join(FS.join(x) for x in (["a", "b", "c"], ["3", "", "9"], ["X", "Y", "Z"], ["s1", "s2", "s, 3"]))
        assert [r[0] for r in rank(raw, 2)] == ["c", "a"], rank(raw, 2)
        assert rank(raw, 3)[0][3] == "s, 3"
        print("ok")
    else:
        main()
