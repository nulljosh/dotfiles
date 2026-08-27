---
name: asc-name-creator
description: Brainstorm and verify App Store app name candidates, checking real-time availability against Apple's exact-match namespace using asc. Use when an app name is taken, when naming/renaming an app for the App Store, or when asked to find an available app name.
---

# ASC Name Creator

App name availability is exact-match, per-account, and *not* reflected in search results — a name can look free in `asc apps public search` and still be rejected as a duplicate (confirmed: "Sparkboard" had no search hit and was still rejected). Every public checker (namecheckly, checkappnames, appdrift) just queries the iTunes Search API, so they're all wrong the same way. The only truth is attempting the rename and reading Apple's response.

`probe.sh` does that **against a throwaway app record**, so the check is free and repeatable — the real app is never touched until the user picks a name.

## Preconditions

- `asc auth token --confirm` works.
- A throwaway ASC record to probe against. Default is `6783501927` (Lexly Mac — the duplicate record slated for deletion). `probe.sh` refuses to run against anything with a version in READY_FOR_SALE / IN_REVIEW / WAITING_FOR_REVIEW / PENDING_*.

## Workflow

### 1. Brainstorm ~20 candidates

Probing is cheap now, so go wide.

- **Single word by default.** Do not propose multi-word/compound names ("Briefkeeper", "Case File") unless the user says two words are fine.
- **Vary roots, not suffixes** — don't submit Spark/Sparkly/Sparker; mix in unrelated roots so one rejection doesn't kill the batch.
- If the user gives themes ("law-inspired", "something nautical"), root *every* candidate in them and don't drift to generic startup filler after rejections. Ask for themes up front if the app's domain doesn't make good candidates obvious.

### 2. Cheap pre-filter (optional, not authoritative)

```bash
asc apps public search --term "<candidate>" --country us
```

Drop exact-name hits. Skipping this step costs nothing but a few probe calls.

### 3. Probe (authoritative)

```bash
./probe.sh Foo Bar Baz Qux        # prints "Foo  AVAILABLE" / "Bar  TAKEN"
ASC_PROBE_APP=<id> ./probe.sh ... # different throwaway record
```

Nothing is applied — the script restores the probe record's name on exit, including on Ctrl-C. If it ever prints a restore WARNING, rename that record back manually before doing anything else.

### 4. Present the shortlist

Give the user the AVAILABLE names and let them choose. Do not auto-apply the first hit.

Optional, only when the app has a web presence: check `.com` (Vercel MCP `check_domain_availability_and_price`) and the GitHub name (`gh repo view nulljosh/<name>`). Trademark screening is out of scope — say so rather than implying it was checked.

### 5. Apply to the real app

```bash
asc apps rename --app <APP_ID> --locale en-US --name "<Chosen>"
```

Live immediately.

### 6. Propagate the rename everywhere else

The rename only changes the App Store listing name — not the on-device display name, the repo, or any hosting surface. Sweep all of these (skip what doesn't apply):

- **iOS/macOS display name**: `INFOPLIST_KEY_CFBundleDisplayName` in `ios/project.yml` and `macos/project.yml` (some macOS targets inherit the Xcode target name instead — check first). Re-run `xcodegen generate`.
- **Repo docs**: `grep -rl "<OLD_NAME>" <repo>` (excluding `.git/`, `.asc/artifacts/`), sed-replace across README, CLAUDE.md, roadmap.md, and any web `index.html` / `manifest.json` (`name`, `short_name`, `<title>`, on-page brand strings).
- **Machine-wide docs**: `~/Documents/Code/CLAUDE.md` reference table row.
- **Memory**: update the `project_app_renames` entry with the new name, date, what got touched, and the rejected candidates (useful later for trademark/name-release disputes).
- **GitHub repo**: `gh repo rename <new> --repo nulljosh/<old>` (confirm first — changes the clone URL; then `git remote set-url origin https://github.com/nulljosh/<new>.git`).
- **Vercel project**: project names rarely need changing (the domain/alias is separate) — confirm before assuming a no-op.
- **Cloudflare DNS**: only if the subdomain itself contains the old name (`oldname.heyitsmejosh.com`).
- **Commit + push + deploy.**

### 7. Report

Final live name, everywhere it propagated, and which candidates came back TAKEN.

## Notes

- `asc apps rename` is `[experimental]`. If it breaks, the underlying call is a PATCH to `appInfoLocalizations/<id>` with `attributes.name`; get the id via `GET /v1/apps/<APP_ID>/appInfos` → `GET /v1/appInfos/<id>/appInfoLocalizations`, auth `Bearer $(asc auth token --confirm)`.
- Taken looks like `ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE.DIFFERENT_ACCOUNT` / "The app name you entered is already being used".
- ASC reads are eventually consistent — a name read straight after a write can be stale. `probe.sh` retries its restore for this reason.
- For brand-new apps not yet in ASC, creation goes through `asc web apps create` (see `asc-app-create-ui`); the same duplicate rejection applies there, so probe the name first.
