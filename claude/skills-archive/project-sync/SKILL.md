---
name: project-sync
description: Sweep shipped projects under ~/Documents/Code and patch cross-project gaps — e.g. one app has a native/kmp port and others don't, one has architecture.svg/screenshots and others don't. Use when the user asks to sync projects, patch gaps across the codebase, or invokes /project-sync.
---

# project-sync

Every "shipped app" repo (has a `WHITEPAPER.md` — that's the marker used elsewhere in this
codebase to mean real product, not tooling/infra repo) should carry the same baseline:
`architecture.svg`, `screenshots/`, and (per [[project_native_fleet_rollout]]) a `kmp/` native
port. Infra/tooling repos (dotfiles, scripts, os, supabase, plan, hackrange, slicehack, agent-101,
erdos-targets, logans-frenchies, nyc, video-speed-ext, credis, swing, hessian4, canlii-app) are
exempt — don't flag them.

## Steps

1. List repos: `find ~/Documents/Code -maxdepth 1 -type d`. For each, check for `WHITEPAPER.md`
   to decide if it's a shipped app worth syncing.
2. For each shipped app, check for `architecture.svg`, `screenshots/`, `kmp/`. Build a gap table.
3. Fix what's mechanically fixable now:
   - Missing `architecture.svg` → invoke the `architecture-svg` skill for that repo.
   - Missing `screenshots/` → invoke the `screenshot-refresh` skill (this repo) for that app.
4. `kmp/` gaps are real native-port work, not something to fake — don't scaffold an empty `kmp/`
   dir. Instead append one line to that repo's `roadmap.md` (create if missing):
   `- [ ] native (kmp) port — sibling apps have one, this doesn't (project-sync YYYY-MM-DD)`
5. Print a short summary table (repo | gaps found | gaps fixed | gaps deferred to roadmap).
   Don't commit/push anything outside the repo itself — leave that to the user's normal git flow.

## Rules
- ponytail: this only checks the three markers above (arch svg, screenshots, kmp). Don't invent
  more "consistency" checks (linting, test coverage, CI config) unless the user asks — scope
  creep here just turns into a slow, noisy audit nobody reads.
- Re-running this skill should be idempotent: it must skip repos that already have all three.

## Usage awareness
Step 3's fixes (architecture-svg, screenshot-refresh) each spawn real work per repo — if usage is tight, run the gap table (steps 1-2) alone and defer fixes to a follow-up run, or fix only the 2-3 highest-value shipped apps rather than every gap fleet-wide in one pass.
