---
name: docs-sweep
description: Find every app under ~/Documents/Code missing a README.md, WHITEPAPER.md or docs/ARCHITECTURE.md (or under 95% docs coverage) and write them in the house voice. Use when the user asks to document all apps, fill in missing docs, or invokes /docs-sweep.
---

# /docs-sweep — fill in missing docs, house voice

1. **Scan**: for each top-level dir in `~/Documents/Code` that's a real project (has its own git repo or package/Package.swift/wrangler.toml — skip `scripts`, `notes`, `os`, `supabase`, dotfiles, loose files), check for `README.md` and `WHITEPAPER.md`.

2. **Missing README.md**: write one following `~/Documents/Code/README-TEMPLATE.md` exactly (see [[readme-voice-template]] memory) — problem punch, "That's the gap", mechanism, "That's it. That's the whole product.", one metaphor, v0/v1/business, then code blocks with real commands/URLs pulled from the project's own package.json/wrangler.toml/Package.swift/scripts.

3. **Missing WHITEPAPER.md**: same voice, prose only, never code (per house voice) — what it is, why it exists, how it works at a systems level, where it's going.

4. Base every doc on what's actually in the repo (read package.json, main source files, existing roadmap.md) — never invent features or URLs. Skip a project entirely if you can't tell what it does from the code in under a minute; flag it instead of guessing.

5. **docs/ARCHITECTURE.md + coverage**: run `python3 ~/Documents/Code/scripts/progress-svg.py <repo>` on every repo; it prints "% documented" (code files named in `docs/ARCHITECTURE.md`, or covered by a `dir/` row) and rewrites `progress.svg`. Anything under 95% gets its architecture doc written or patched: intro, "How it runs", then `| File | What it owns |` tables with a real sentence per file. Reference: `joshuatree/docs/ARCHITECTURE.md`. Commit the doc and `progress.svg` together, push.

6. **Report**: TLDR list of which projects got which doc, and which were skipped/flagged.

## Usage awareness
One Haiku subagent at a time working repos sequentially, two max. Never a wide fan-out, it burns the usage window in minutes. Keep going until every missing doc is filled or flagged.
