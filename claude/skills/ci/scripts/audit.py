#!/usr/bin/env python3
"""Split recent GitHub Actions runs into waiting / setup / running, at p50 and p95.

  waiting = job queued -> runner picked it up            (job.started_at - job.created_at)
  setup   = job time not spent in "real" steps           (checkout, toolchain, cache, install, post-steps, gaps)
  running = the steps in between (lint, tests, build...)

Usage:
  audit.py [--repo OWNER/NAME] [--runs 150] [--branch B] [--event pull_request]
           [--workflow ci.yml] [--json OUT.json] [--compare BEFORE.json]
           [--budget 35] [--setup-pattern REGEX]

Needs an authenticated `gh`. Stdlib only. Takes ~1 min for 150 runs.
"""
import argparse
import json
import math
import re
import subprocess
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from urllib.parse import quote

SETUP_RE = r"set ?up|checkout|cache|install|restore|download|login|toolchain|prepare|configure|docker pull|initiali[sz]e"
TEARDOWN_RE = r"^post |complete job|upload|save|cleanup|stop containers"


def gh(args):
    r = subprocess.run(["gh"] + args, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("gh %s failed: %s" % (" ".join(args), r.stderr.strip()))
    return [json.loads(l) for l in r.stdout.splitlines() if l.strip()]


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


def secs(a, b):
    return (b - a).total_seconds() if a and b else None


def pct(xs, p):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    return xs[max(0, math.ceil(p / 100.0 * len(xs)) - 1)]


def fmt(x):
    if x is None:
        return "-"
    return "%.0fs" % x if abs(x) < 600 else "%.1fm" % (x / 60)


def fetch_runs(repo, n, branch, event, workflow):
    base = "repos/%s/actions/%sruns" % (repo, "workflows/%s/" % workflow if workflow else "")
    runs, page = [], 1
    while len(runs) < n:
        q = "%s?per_page=100&page=%d&status=completed" % (base, page)
        if branch:
            q += "&branch=" + quote(branch, safe="")
        if event:
            q += "&event=" + event
        batch = gh(["api", q, "--jq", ".workflow_runs[]"])
        if not batch:
            break
        runs += batch
        page += 1
    return runs[:n]


def fetch_jobs(repo, run_id):
    return gh(["api", "--paginate",
               "repos/%s/actions/runs/%s/jobs?per_page=100&filter=latest" % (repo, run_id),
               "--jq", ".jobs[]"])


def split(job, setup_re, teardown_re):
    c, s, e = ts(job.get("created_at")), ts(job.get("started_at")), ts(job.get("completed_at"))
    if not (s and e) or job.get("conclusion") in ("skipped", "cancelled"):
        return None
    total = max(0.0, secs(s, e))
    wait = max(0.0, secs(c, s)) if c else 0.0
    steps = [st for st in (job.get("steps") or [])
             if st.get("started_at") and st.get("completed_at") and st.get("conclusion") != "skipped"]
    # Any step whose name looks like setup or teardown is overhead wherever it sits (joshuatree runs a
    # check before its apt installs); the rest is the job's real work.
    work = [st for st in steps if not (setup_re.search(st["name"]) or teardown_re.search(st["name"]))]
    running = sum(max(0.0, secs(ts(st["started_at"]), ts(st["completed_at"]))) for st in work)
    running = min(running, total)
    return {"wait": wait, "setup": total - running, "run": running, "total": total,
            "completed": e, "labels": ",".join(sorted(job.get("labels") or [])) or "?"}


def summarize(repo, runs, jobs_by_run, setup_re, teardown_re, budget):
    per_job = defaultdict(lambda: defaultdict(list))
    crit = defaultdict(list)
    pr_groups = defaultdict(lambda: {"start": None, "end": None})
    minutes = defaultdict(lambda: {"seconds": 0.0, "billable_min": 0})
    reruns = []
    for run in runs:
        if (run.get("run_attempt") or 1) > 1:
            reruns.append("%s #%s (attempt %s)" % (run.get("name"), run.get("run_number"), run.get("run_attempt")))
        parts = []
        for job in jobs_by_run.get(run["id"], []):
            sp = split(job, setup_re, teardown_re)
            if not sp:
                continue
            parts.append(sp)
            key = "%s / %s" % (run.get("name"), job.get("name"))
            for k in ("wait", "setup", "run", "total"):
                per_job[key][k].append(sp[k])
            m = minutes[sp["labels"]]
            m["seconds"] += sp["total"]
            m["billable_min"] += int(math.ceil(sp["total"] / 60.0)) if sp["total"] > 0 else 0
        if not parts:
            continue
        last = max(parts, key=lambda p: p["completed"])  # the job that decided when the run was done
        for k in ("wait", "setup", "run"):
            crit[k].append(last[k])
        # run_started_at is the start of the latest attempt; created_at would count a re-run's idle gap
        start = ts(run.get("run_started_at") or run["created_at"])
        crit["wall"].append(secs(start, last["completed"]))
        if run.get("event") == "pull_request":
            g = pr_groups[run["head_sha"]]
            g["start"] = start if g["start"] is None or start < g["start"] else g["start"]
            g["end"] = last["completed"] if g["end"] is None or last["completed"] > g["end"] else g["end"]

    created = [ts(r["created_at"]) for r in runs]
    span_days = max(secs(min(created), max(created)) / 86400.0, 1.0) if created else 1.0
    pr_times = [secs(g["start"], g["end"]) for g in pr_groups.values()]

    out = {
        "repo": repo,
        "runs": len(runs),
        "from": min(created).isoformat() if created else None,
        "to": max(created).isoformat() if created else None,
        "span_days": round(span_days, 1),
        "pr_result": {"n": len(pr_times), "p50": pct(pr_times, 50), "p95": pct(pr_times, 95)},
        "critical_path": {k: {"p50": pct(v, 50), "p95": pct(v, 95)} for k, v in crit.items()},
        "jobs": {},
        "reruns": reruns,
        "usage": {},
        "budget_s": budget,
    }
    for name, d in per_job.items():
        out["jobs"][name] = {"n": len(d["total"])}
        for k in ("wait", "setup", "run", "total"):
            out["jobs"][name][k] = {"p50": pct(d[k], 50), "p95": pct(d[k], 95)}
    for labels, m in minutes.items():
        out["usage"][labels] = {
            "job_minutes": round(m["seconds"] / 60.0, 1),
            "billable_minutes": m["billable_min"],
            "billable_minutes_per_30d": round(m["billable_min"] / span_days * 30),
        }
    return out


def print_report(s):
    print("%s: %d completed runs, %s .. %s (%.1f days)" % (
        s["repo"], s["runs"], (s["from"] or "")[:10], (s["to"] or "")[:10], s["span_days"]))
    pr = s["pr_result"]
    print("\nPR time-to-result (push -> last job done, per head SHA, n=%d): p50 %s  p95 %s   target p50 60s, p95 120s" % (
        pr["n"], fmt(pr["p50"]), fmt(pr["p95"])))

    cp = s["critical_path"]
    print("\nCritical path (the last job to finish in each run):")
    for k, label in (("wait", "waiting"), ("setup", "setup"), ("run", "running"), ("wall", "run wall")):
        if k in cp:
            print("  %-9s p50 %6s   p95 %6s" % (label, fmt(cp[k]["p50"]), fmt(cp[k]["p95"])))
    buckets = [(k, cp[k]["p95"] or 0) for k in ("wait", "setup", "run") if k in cp]
    if buckets:
        big = max(buckets, key=lambda b: b[1])[0]
        print("  -> biggest bucket at p95: %s. Fix it first." % {"wait": "waiting", "setup": "setup", "run": "running"}[big])

    print("\nPer job, p50/p95 (! = total p95 over the %ss job budget):" % s["budget_s"])
    print("  %-52s %4s %15s %15s %15s %15s" % ("workflow / job", "n", "waiting", "setup", "running", "total"))
    rows = sorted(s["jobs"].items(), key=lambda kv: -(kv[1]["total"]["p95"] or 0))
    if len(rows) > 25:
        print("  (slowest 25 of %d jobs; --json has all)" % len(rows))
    for name, j in rows[:25]:
        flag = "!" if (j["total"]["p95"] or 0) > s["budget_s"] else " "
        cells = ["%6s/%-6s" % (fmt(j[k]["p50"]), fmt(j[k]["p95"])) for k in ("wait", "setup", "run", "total")]
        print("%s %-52s %4d %15s %15s %15s %15s" % (flag, name[:52], j["n"], *cells))

    print("\nRe-run attempts (a check that needs a retry has a bug): %d" % len(s["reruns"]))
    for r in s["reruns"][:15]:
        print("  " + r)

    print("\nRunner usage in sample (GitHub bills each job rounded up to the minute):")
    for labels, u in sorted(s["usage"].items(), key=lambda kv: -kv[1]["billable_minutes"]):
        print("  %-40s %8.1f job-min  %6d billable  ~%d billable/30d" % (
            labels[:40], u["job_minutes"], u["billable_minutes"], u["billable_minutes_per_30d"]))


def print_compare(before, after):
    def row(label, b, a):
        d = None if b is None or a is None else a - b
        print("  %-28s %8s -> %-8s %s" % (label, fmt(b), fmt(a), "" if d is None else "(%+.0fs)" % d))
    print("\nBefore -> after:")
    row("PR result p50", before["pr_result"]["p50"], after["pr_result"]["p50"])
    row("PR result p95", before["pr_result"]["p95"], after["pr_result"]["p95"])
    for k in ("wait", "setup", "run", "wall"):
        if k in before["critical_path"] and k in after["critical_path"]:
            row("critical %s p50" % k, before["critical_path"][k]["p50"], after["critical_path"][k]["p50"])
            row("critical %s p95" % k, before["critical_path"][k]["p95"], after["critical_path"][k]["p95"])
    bm = sum(u["billable_minutes_per_30d"] for u in before["usage"].values())
    am = sum(u["billable_minutes_per_30d"] for u in after["usage"].values())
    print("  %-28s %8d -> %-8d" % ("billable min / 30d", bm, am))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo")
    ap.add_argument("--runs", type=int, default=150)
    ap.add_argument("--branch")
    ap.add_argument("--event")
    ap.add_argument("--workflow", help="workflow file name or id, e.g. ci.yml")
    ap.add_argument("--json", help="write the summary here (keep it as the 'before' numbers)")
    ap.add_argument("--compare", help="a summary JSON from an earlier audit to diff against")
    ap.add_argument("--budget", type=float, default=35, help="per-job budget in seconds (default 35)")
    ap.add_argument("--setup-pattern", default=SETUP_RE, help="regex for step names that count as setup")
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()

    try:
        repo = a.repo or gh(["repo", "view", "--json", "nameWithOwner"])[0]["nameWithOwner"]
        runs = fetch_runs(repo, a.runs, a.branch, a.event, a.workflow)
        if not runs:
            sys.exit("no completed runs found for %s with those filters" % repo)
        with ThreadPoolExecutor(max_workers=a.workers) as ex:
            jobs = dict(zip([r["id"] for r in runs], ex.map(lambda r: fetch_jobs(repo, r["id"]), runs)))
    except RuntimeError as e:
        sys.exit(str(e))

    s = summarize(repo, runs, jobs, re.compile(a.setup_pattern, re.I), re.compile(TEARDOWN_RE, re.I), a.budget)
    print_report(s)
    if a.compare:
        with open(a.compare) as f:
            print_compare(json.load(f), s)
    if a.json:
        with open(a.json, "w") as f:
            json.dump(s, f, indent=2, default=str)
        print("\nwrote " + a.json)


if __name__ == "__main__":
    main()
