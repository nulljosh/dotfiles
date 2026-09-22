#!/usr/bin/env python3
"""Strip checked-off (- [x]) bullets and their indented continuation lines
from a roadmap.md, then drop any ## heading section left with no content
(never touches the top-level # title), and collapse extra blank lines.
History lives in git log; the roadmap should only ever show what's still open.

Modes:
  prune.py --list <path>            print each [x] block as "N: <first line>"
                                     (for a verification pass), no changes made
  prune.py --keep 3,7,12 <path>     remove all [x] blocks EXCEPT these indices
  prune.py <path> [path2 ...]       remove all [x] blocks (default, no verify)
"""
import re
import sys
from pathlib import Path


def find_blocks(lines):
    """Return list of (start, end) exclusive index ranges for each [x] block."""
    blocks = []
    i, n = 0, len(lines)
    while i < n:
        if re.match(r"^- \[x\]", lines[i].strip()):
            start = i
            i += 1
            while i < n and lines[i].strip() != "" and not re.match(r"^\s*- \[", lines[i]) and not lines[i].startswith("#"):
                i += 1
            blocks.append((start, i))
            continue
        i += 1
    return blocks


def strip_blocks(lines, keep_indices=None):
    keep_indices = keep_indices or set()
    blocks = find_blocks(lines)
    drop_ranges = [b for idx, b in enumerate(blocks) if idx not in keep_indices]
    drop_lineset = set()
    for start, end in drop_ranges:
        drop_lineset.update(range(start, end))
    out = [line for i, line in enumerate(lines) if i not in drop_lineset]

    # drop ## (or deeper) headings with no non-blank content before the next
    # heading of equal-or-shallower level; never touches the # H1 title.
    cleaned = []
    j, m = 0, len(out)
    while j < m:
        line = out[j]
        if line.startswith("##"):
            k = j + 1
            has_content = False
            while k < m and not out[k].startswith("#"):
                if out[k].strip():
                    has_content = True
                k += 1
            if not has_content:
                j = k
                continue
        cleaned.append(line)
        j += 1

    # collapse 2+ blank lines to 1
    result = []
    blank = False
    for line in cleaned:
        if line.strip() == "":
            if blank:
                continue
            blank = True
        else:
            blank = False
        result.append(line)

    return result


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    if args[0] == "--list":
        path = Path(args[1])
        lines = path.read_text().split("\n")
        for idx, (start, end) in enumerate(find_blocks(lines)):
            print(f"{idx}: {lines[start].strip()}")
        return

    keep = set()
    if args[0] == "--keep":
        keep = {int(x) for x in args[1].split(",") if x.strip() != ""}
        paths = args[2:]
    else:
        paths = args

    for arg in paths:
        path = Path(arg)
        if not path.exists():
            continue
        before = path.read_text()
        before_lines = before.split("\n")
        after_lines = strip_blocks(before_lines, keep)
        after = "\n".join(after_lines).rstrip("\n") + "\n"
        if after != before:
            path.write_text(after)
            print(f"{path}: {len(before_lines)} -> {len(after_lines)} lines")


if __name__ == "__main__":
    main()
