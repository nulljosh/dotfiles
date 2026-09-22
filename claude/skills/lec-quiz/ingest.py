#!/usr/bin/env python3
"""Merge a captured LEC/D2L quiz into a Lingo (lexly) course pack."""
import json, sys, re
from pathlib import Path

PACKS = Path.home() / "Documents/Code/lexly/content/courses"


def norm(q):
    return re.sub(r"\s+", " ", q).strip().lower()


def merge(pack, capture):
    """Mutates pack; returns list of added question texts."""
    pid = pack["id"]
    uid = f"u{capture['unit']}"
    unit = next((u for u in pack["units"] if u["id"] == uid), None)
    if unit is None:
        unit = {"id": uid, "title": capture.get("unitTitle", f"Unit {capture['unit']}"), "lessons": []}
        pack["units"].append(unit)
        pack["units"].sort(key=lambda u: int(u["id"][1:]))

    title = capture["lesson"]
    lesson = next((l for l in unit["lessons"] if l["title"] == title), None)
    if lesson is None:
        lesson = {"id": f"{uid}l{len(unit['lessons']) + 1}", "title": title, "exercises": []}
        unit["lessons"].append(lesson)

    seen = {norm(e["question"]) for u in pack["units"] for l in u["lessons"] for e in l["exercises"]}
    lnum = lesson["id"].split("l")[-1]
    added = []
    for q in capture["questions"]:
        if norm(q["question"]) in seen:
            continue
        seen.add(norm(q["question"]))
        ex = {
            "type": "mathChoice" if q.get("choices") else "math",
            "question": q["question"],
            "answer": q["answer"],
            "id": f"{pid}_u{capture['unit']}_l{lnum}_{len(lesson['exercises'])}",
        }
        if q.get("choices"):
            ex["choices"] = q["choices"]
        lesson["exercises"].append(ex)
        added.append(q["question"])
    return added


def demo():
    pack = {"id": "precalc12", "units": []}
    cap = {"unit": 3, "lesson": "Factoring", "questions": [
        {"question": "Factor x^2-9", "answer": "(x-3)(x+3)", "choices": ["(x-3)(x+3)", "prime"]},
        {"question": "factor  X^2-9", "answer": "dup"},
        {"question": "f(2) if f(x)=x", "answer": "2"}]}
    assert len(merge(pack, cap)) == 2, "dedupe failed"
    ex = pack["units"][0]["lessons"][0]["exercises"]
    assert ex[0]["type"] == "mathChoice" and ex[1]["type"] == "math"
    assert ex[0]["id"] == "precalc12_u3_l1_0"
    assert merge(pack, cap) == [], "re-merge should be a no-op"
    print("ok")


if __name__ == "__main__":
    if "--demo" in sys.argv:
        demo(); sys.exit()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    pack_id = sys.argv[sys.argv.index("--pack") + 1] if "--pack" in sys.argv else "precalc12"
    path = PACKS / f"{pack_id}.json"
    capture = json.loads(Path(args[0]).read_text())
    pack = json.loads(path.read_text())
    added = merge(pack, capture)
    path.write_text(json.dumps(pack, indent=2) + "\n")
    print(f"{path}: +{len(added)} question(s)")
    for q in added:
        print("  ", q[:80])
