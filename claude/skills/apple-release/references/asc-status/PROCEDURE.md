---
name: asc-status
description: Check App Store Connect status for every app (live, in flight, rejected), read the Resolution Center rejection reasons, and fix them without opening Chrome. Use when the user says /asc-status, "check asc", "which apps are rejected", "why was X rejected", "fix the rejections", or when asc-login is failing or Apple returns a 503.
---

# asc-status

One command for the state of every app, then the reason and the fix for each rejection. Chrome is the last resort, not the first.

## 1. Status (API, no web session)
```
/Users/joshua/Documents/Code/dotfiles/claude/skills/apple-release/references/asc-status/scripts/status.py
```
Prints REJECTED / IN FLIGHT / LIVE for every app and platform (newest version per platform wins). Matches the ASC apps page exactly, verified 2026-10-03. Takes about 20 seconds. After a pull, refresh the ledger at `wiki/pages/asc-status.md` in the Obsidian vault (states and the reasons table).

## 2. Reasons (needs a web session)
`status.py --reasons` calls `asc web review show` for each rejected app. The public API has no Resolution Center text, only the web session does. That part of the script is untested, because the session was expired when it was written. Check it the first time.

Order of attack when you need the reason text:
1. `asc web auth status`. If it says `"authenticated":true`, run `status.py --reasons`.
2. Expired: run `asc-login` **once**. It now refuses to run again for 20 minutes. If Apple answers **503**, it is throttling the account. Every attempt counts toward the limit, including Ctrl-C during 2FA. Wait 20+ minutes. Never loop, never queue retries.
3. Still blocked: use the user's logged-in Chrome (recipe below). Ask the user to log in on the page; do not type credentials.

## 3. Chrome recipe (fallback)
Tools: tabs_context_mcp, navigate, read_page, get_page_text, browser_batch.
1. `https://appstoreconnect.apple.com/apps` then get_page_text lists every app with its state.
2. Per app: navigate to `/apps/<id>/distribution/reviewsubmissions`, wait about 9 seconds (the table loads slowly), then `read_page` with `filter: interactive`. The submission links carry hrefs `/reviewsubmissions/details/<uuid>`.
3. navigate to each details URL, wait 9 seconds, get_page_text. The Apple message is in the page text.
4. Do not click table rows by coordinate. The first click after a navigation does not register. Use the hrefs.

## 4. Fix playbook by guideline
| Guideline | What it means | Fix |
|---|---|---|
| 4.3(a) spam | Similar binary, metadata or concept to other apps | Do **not** resubmit unchanged. Every 4.3(a) notice carries an Extended Review warning: repeated bad submissions slow reviews and can end in removal from the Developer Program. First decide honestly: does the app have real substance? If yes, a true, specific reply works (Healstack macOS, 2026-09-05: "shares no source with any other app", Apple withdrew the spam claim; Curvely's appeal also won). If the app is thin (Windgate, Madobe) the fix is real native features, then resubmit with notes naming exactly what is new. Never change icons or metadata just to dodge a similarity check |
| 2.1(a) completeness | A bug Apple hit | Reproduce on the exact device and OS in the message (iOS 27, iPad Air M3, iPhone 17 Pro Max). Fix, test a release build, then resubmit. Apple often allows a reply instead of a resubmit if it ships as a bug fix |
| Sign in with Apple error | SIWA fails on a device | Use the `apple-signin-fix` skill: Supabase client ID list, App ID capability, entitlement, Services ID |
| 4.8 login services | A third-party login with no equivalent like Sign in with Apple | Add Sign in with Apple, or reply naming the login option that already meets all three rules (limits data to name and email, hides email, no ad tracking) |
| 2.3.8 metadata (macOS) | App Store name differs from the installed name | Make the Xcode display and product name match the ASC name, or change the ASC name. Never change the bundle ID |
| 1.5 support URL | The support URL is not a working support page | Point it at a live page with a way to ask for help |
| 4.2 / 4.2.2 minimum functionality | Feels like a web view or web aggregation | Needs real native features. Not a quick fix: decide whether the app earns its place before spending a build |
| 4 design | Cut-off text and layout | Check large text sizes and small windows. Attach fresh screenshots |
| 2.3 metadata | Claims the app does not back up (for example "one purchase") | Delete or correct the claim in the listing |

## 5. Rules
- Never reply to App Review, submit, resubmit, cancel a submission or remove an item without the user's explicit yes for that action. Drafting a reply is fine. Replies must be true: do not say a bug is fixed until it is, and verify first.
- Before any submission run `asc validate` (see the asc-release-flow skill). Archive and upload with the asc-xcode-build skill. Naming goes through asc-name-creator.
- Record new reasons and states in the vault ledger. If a reason appears in a repo's `roadmap.md`, keep the two in sync.
- Do not use the rejection list to chase volume. A rejection wave means the portfolio looks repetitive to Apple. Fewer, clearly different apps beat more clones.

## 6. Replying to Apple without Chrome
Replies work headlessly with the asc web session cookies (`~/.asc/web/session-*.json`) against `https://appstoreconnect.apple.com/iris/v1/`. Details in memory `reference_asc_resolution_center_headless`. Needs a live web session.
1. Thread id: `asc web review show --app <id>` then `threads[].thread.id`.
2. `POST resolutionCenterDraftMessages` with `messageBody` and the thread relationship. Only one draft per thread, so PATCH an existing one.
3. **Show the draft to Joshua and wait for a yes.** Only then `POST resolutionCenterMessages` with `createFromDraftMessage` to publish. Responses are gzipped.
Reply text must be true and specific: name the build, say what changed, never claim a fix that is not shipped. Two notices (Lexly 2.1(a), Healstack 4.8) say a reply can approve a bug-fix submission without a resubmit. Do not use that unless the fix is in the build under review.

## 7. Resubmit recipe (proven 2026-10-03: Lexly, Healstack, Curbfind iOS)
A rejected version cannot get a new sibling version (Apple: "cannot create a new version in the current state"), and a build's version string must match its record. So rebuild at the **same version string** with a higher build number.
1. **Fix and prove it.** Reproduce in the simulator, then A/B the fix (build the old code in a `git worktree`, tap the same thing). Curbfind: original code highlighted a row and never navigated, fix opened it.
2. **Bump the build:** `asc xcode version edit --version <same> --build-number $(date +%Y%m%d%H%M)`. If the xcodeproj is generated and untracked (Healstack), edit `project.yml` and run `xcodegen generate`. A later xcodegen run can silently revert hand edits to the pbxproj (it undid Lexly's iPhone-only and manual-signing fix).
3. **Archive on the LaCie drive:** `asc xcode archive ... --xcodebuild-flag=-allowProvisioningUpdates --xcodebuild-flag=-derivedDataPath --xcodebuild-flag=/Volumes/LaCie/lexly-qa/dd-X`, with `TMPDIR=/Volumes/LaCie/lexly-qa/tmp`. Check the real scheme name with `xcodebuild -list` (Healstack is `Healstack`, not `Dose`). Export with the repo's ExportOptions plist.
4. **Verify the IPA, not the source:** unzip it and run `plutil -extract CFBundleVersion raw -o - APP/Info.plist`, `plutil -extract UIDeviceFamily json -o -`, `codesign -d --entitlements - APP` (get-task-allow must be false). **Use shell globs for paths, never `ls -d` output:** `ls` here prints icon glyphs and corrupts the path.
5. **Upload and attach:** `asc publish appstore --app ID --ipa X --version <same> --wait` (no `--submit`). Then `asc builds update --build-id ID --uses-non-exempt-encryption=false` if the build shows encryption "n/a" (do not combine `--build-id` with `--app`).
6. **Rewrite the review notes so every line is true** (`asc review details-update`). Delete stale lines: Healstack's said "Sign in with Apple is intentionally not offered" and would have become false.
7. **Validate:** `asc validate --app ID --version-id VID --platform IOS --ipa X`. Real blockers seen: an empty screenshot set, iPad screenshots when `UIDeviceFamily` includes 2, and screenshots of the wrong app (Lexly's listing had Bookrank images). If two app-info records exist the validator fails; check age ratings by hand.
8. **Resubmit:** `asc review submissions list --app ID` (take the UNRESOLVED_ISSUES one), `asc review items list --submission SUB`, `asc review items update --id ITEM --resolved true`, `asc review submissions-submit --id SUB --confirm`.
9. **Commit, push (`git pull --rebase --autostash` first, other sessions push too), save to memory.**
Screenshots without a login wall: Lexly's iOS app launched with the argument `UITEST_SNAPSHOT` is mock signed-in. `asc screenshots run --plan` can tap by accessibility label and screenshot, but cannot scroll, and cannot tap a search field by placeholder text. A stale `.asc/screenshots.json` can belong to a different app: read it before trusting it.

Swapping the build on a version that is already WAITING_FOR_REVIEW: attach fails ("pre-release build could not be added"). Cancel first: `asc review submissions-update --id SUB --canceled=true --confirm`; wait until the submission is COMPLETE (a few minutes; the version then shows DEVELOPER_REJECTED, which is only your own cancel, not an Apple rejection), update the notes, then `asc review submit --app ID --version V --build-id NEWBUILD --confirm` (use `--dry-run` first; it attaches and submits in one step). `asc validate --ipa` refuses an IPA that is not the attached build, so validate after attaching or rely on the earlier run.

## 8. Machine gotchas
- **Never run `sync`.** It is Joshua's repo pull and push script, not the disk flush.
- **Disk:** the internal volume sits at 98 to 100%. Booted simulators and builds took it to 175 MB free. Keep DerivedData, build output and TMPDIR on `/Volumes/LaCie/lexly-qa`. Clear `~/Library/Developer/Xcode/DerivedData` first. ENOSPC makes tools fail to even write output: run the cleanup with the sandbox off.
- Other Claude panes own the rest of `/private/tmp/claude-501`; do not delete it.
- Resolution Center attachments are download-only (needs the user's OK). The message history is readable in Chrome and often explains more than the final rejection (Healstack macOS: Apple dropped a 4.3(a) after a true reply).

## 9. Known state (2026-10-03)
Reasons are in `wiki/pages/asc-status.md` (vault). Eight apps rejected: Lexly iOS (SIWA error), Curbfind iOS (taps unresponsive), Healstack iOS (4.8) and macOS (cut-off text), Madobe macOS (name, support URL, 4.2) and iOS (4.3a), Sidewise iOS (4.2.2), and Plaintxt, Windgate, Siftbox (4.3a). Never resubmit the 4.3(a) ones as they are.
