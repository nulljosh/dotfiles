#!/usr/bin/env python3
"""Mirror a repo's open roadmap items into GitHub issues.

usage: roadmap-to-issues.py <repo-dir> [--dry-run]

Idempotent: an item whose title already exists as an issue (open or closed) is skipped.
Checked-off items whose issue is still open get closed.
ponytail: title match is the dedupe key, no state file. Rename an item = new issue.
"""
import json, re, subprocess, sys, pathlib

BUG = re.compile(r"\b(bug|broken|fix|crash|fails?|regression|error)\b", re.I)


def sh(*args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def items(path):
    """Top-level checkbox items only, with their nearest ## heading."""
    heading = ""
    for line in path.read_text().splitlines():
        if line.startswith("## "):
            heading = line[3:].strip()
            continue
        m = re.match(r"^(?:\d+\.|[-*]) \[( |x|~)\] (.+)", line)
        if m:
            text = re.sub(r"[*`]", "", m.group(2)).strip().rstrip(".")
            if len(text) > 5:
                yield m.group(1) != " ", short_title(text), text, heading


def short_title(text, limit=70):
    """A headline, not the whole roadmap line. Full text goes in the issue body.

    ponytail: the title is still the dedupe key (see module docstring), so two
    items sharing a first sentence would collide and the second be skipped.
    roadmap.md stays the source of truth, so that costs a tracker row, not work.
    """
    head = re.split(r"(?<=[.!?])\s", text, maxsplit=1)[0]
    if len(head) <= limit:
        return head.rstrip(".")
    return text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:.") + "\u2026"


def main():
    repo = pathlib.Path(sys.argv[1]).expanduser().resolve()
    dry = "--dry-run" in sys.argv
    rm = next((repo / n for n in ("roadmap.md", "ROADMAP.md") if (repo / n).exists()), None)
    if not rm:
        sys.exit(f"no roadmap in {repo}")
    if sh("gh", "repo", "view", "--json", "name", cwd=repo).returncode:
        sys.exit(f"no gh remote for {repo}")

    existing = {i["title"]: i for i in json.loads(
        sh("gh", "issue", "list", "--state", "all", "--limit", "500",
           "--json", "number,title,state", cwd=repo).stdout or "[]")}

    made = closed = 0
    for done, title, full, heading in items(rm):
        found = existing.get(title)
        if done:
            if found and found["state"] == "OPEN":
                print(f"close #{found['number']} {title}")
                if not dry:
                    sh("gh", "issue", "close", str(found["number"]),
                       "-c", "shipped, checked off in roadmap.md", cwd=repo)
                closed += 1
            continue
        if found:
            continue
        label = "bug" if BUG.search(title) else "enhancement"
        print(f"open  [{label}] {title}")
        if not dry:
            body = "%s\n\nFrom `%s`%s." % (
                full, rm.name, " under **%s**" % heading if heading else "")
            r = sh("gh", "issue", "create", "-t", title, "-l", label, "-b", body, cwd=repo)
            if r.returncode:  # a missing label fails the create. Never count it as opened.
                print(f"FAILED: {r.stderr.strip()[-160:]}")
                continue
        made += 1
    print(f"{repo.name}: {made} opened, {closed} closed{' (dry run)' if dry else ''}")


def self_check():
    long = ("Statement upload, two real bugs found and fixed, awaiting a retry "
            "to confirm they were the cause. The Blob fix was incomplete.")
    t = short_title(long)
    assert t.endswith("\u2026"), t
    assert len(t) <= 71, (len(t), t)
    assert not t.endswith(" \u2026") and "  " not in t, t
    # cuts on a word boundary, never mid-word
    assert long.startswith(t[:-1]), t
    # a short first sentence is kept whole, no ellipsis
    assert short_title("Fix the icon. It is blurry.") == "Fix the icon"
    # a short item passes through untouched
    assert short_title("Add dark mode") == "Add dark mode"
    print("self-check ok")


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        self_check()
    else:
        main()
