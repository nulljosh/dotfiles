---
name: rename
description: Rename an app end to end once the new name has stuck. Use when Joshua locks a new name, says "rename it", or asks to update the repo, landing, docs and App Store listing to a new name.
---

# /rename <old> <new>

A rename is one sweep, done once, with nothing left for Joshua to remind me about. Run it only after the
name has stuck: a clear keep ("lock it", "update everything to it"), never a first "decent" or "you decide"
([[feedback_rename_only_when_it_sticks]]). Names come from `asc-name-creator` first.

## 0. Check the name is real
- App Store: probe with `asc-name-creator` on an editable record. If none exists (every version live or in
  review), pre-filter with an iTunes search and queue the Apple probe for the next editable version.
- No App Store record yet (a web app going native): create it as the probe. `asc web apps create --name <N>
  --bundle-id com.nulljosh.<old> --sku <X> --platform IOS --auto-rename=false`, looping over candidates;
  `DUPLICATE` means taken, the first success is the record. Always pass `--auto-rename=false` or Apple hands
  back "Name 2". `--platform UNIVERSAL` fails with ATTRIBUTE.TYPE; add Mac to the record later. Plain English
  and common foreign words for the thing are nearly all taken (Horula took 19 tries for a clock, 2026-10-25).
- `gh repo view nulljosh/<new>` must 404. `npm view <new>` decides whether a CLI can use the bare name.

## 1. Never rename these (they break installs, saved work or posted links)
- Bundle IDs, Pages project and Worker names, old subdomains (keep them serving).
- localStorage keys, UserDefaults keys, saved-document filenames, file-format marker keys. Grep the store
  and engine for them before any sed and exclude them by exact string.
- File extensions the app opens: add the new one, keep accepting the old one.
List them in the project memory as "still on old names on purpose".

## 2. The sweep, in one commit per repo
1. Case-aware sed of `Old`, `old`, `OLD` across tracked files, minus the step 1 strings. Read the diff.
   When the old name is an ordinary word (Clock, Pan, Echo), do not sed blind: replace only the product
   name with a regex that skips phrases where it is the plain word or a UI label ("World Clock", "iOS
   Clock", `drawClock`), then grep what is left by eye.
2. `git mv` files and folders with the old name (icon bundle, app entry file, entitlements, CLI, skills).
3. Native: rename in `project.yml` (project, targets, schemes, PRODUCT_NAME, entitlements), delete the old
   `.xcodeproj`, `xcodegen generate`, then build Mac, iOS and Watch. Display name changes with the build.
4. Landing and web: title, meta, OG tags and og.png text, canonical and sitemap URLs, the in-app title.
   README gets one line "formerly <Old>" so people from old posts know they are in the right place.
5. Tests, self-checks, build, deploy, curl the live page for the new name.

## 3. Outside the repo
- Domain: add `<new>.jaybulb.com` to the same Pages project or Worker; the old host keeps serving. For a
  Worker that is a second `routes` entry with `custom_domain = true` in `wrangler.toml`, then deploy; the
  certificate is live in under a minute. Point canonical, OG and in-app links at the new host.
- Monorepo app (lives in labs, no repo of its own): `git mv <old> <new>`, flip the `!<old>/` allowlist line
  in labs `.gitignore`, fix the labs CLAUDE.md project list and table, GitHub links (`labs/tree/main/<new>`),
  and the tag prefix going forward (`<new>-vN.0.0`; old tags stay).
- GitHub: `gh repo rename <new>`, `git remote set-url`, `gh repo edit --homepage https://<new>.jaybulb.com` (rename
  leaves the homepage and description on the old name), then move the folder and fix every path that names it
  (labs CLAUDE.md and .gitignore, loop file, LOOP-HANDOFF, CI workflows, scripts, symlinks).
- App Store: the name and subtitle go on the next editable version (`apple-metadata`), store text in
  `docs/store/`. If 2 app infos are locked, queue it in the roadmap and loop file, not as a reminder.
- Product Hunt, launch kit, directories: rename the kit files; live listings Joshua renames by hand.
- Memory: rename `project_<old>.md` content to the new name with "(ex-Old)" in the MEMORY.md line, update
  the loop file name and the ScheduleWakeup prompt.

## 4. Report
One line: what is renamed, what stays on the old name on purpose, and what waits on Apple.
