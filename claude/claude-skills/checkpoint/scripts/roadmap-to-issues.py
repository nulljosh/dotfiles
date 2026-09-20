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
            title = re.sub(r"[*`]", "", m.group(2)).strip().rstrip(".")
            if len(title) > 5:
                yield m.group(1) != " ", title[:200], heading


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
    for done, title, heading in items(rm):
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
            body = "From `%s`%s." % (rm.name, " under **%s**" % heading if heading else "")
            sh("gh", "issue", "create", "-t", title, "-l", label, "-b", body, cwd=repo)
        made += 1
    print(f"{repo.name}: {made} opened, {closed} closed{' (dry run)' if dry else ''}")


if __name__ == "__main__":
    main()
