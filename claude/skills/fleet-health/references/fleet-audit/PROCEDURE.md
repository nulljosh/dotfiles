---
name: fleet-audit
description: Read-only audit of every Apple project under ~/Documents/Code for the bug classes found in the 2026-10-03 App Store fix loop (name mismatches, dead URLs, stale What's New, bundled repo files, Apple sign-in, encryption flag). Use before a release batch or after a rejection wave.
---

# Fleet audit

Run `cd ~/Documents/Code && python3 /Users/joshua/Documents/Code/dotfiles/claude/skills/fleet-health/references/fleet-audit/scripts/audit.py --asc` (drop `--asc` to skip the checks that call the asc CLI; the full run takes about 2 minutes). It prints markdown and edits nothing.

Checks (letters match the queue file): b project.yml vs pbxproj drift, d Sign in with Apple handling and 4.8, e `List(selection:)` with `NavigationLink(value:)`, f old or other app names in code strings, h encryption flag missing, i repo files bundled into the app (`sources: path: .`), j stale What's New version, k support or marketing URL empty or dead, l installed name differs from the App Store name.

## Triage rules
- Fix the metadata classes at once, even on in-review versions: dead support, marketing or privacy URLs (guideline 1.5 and 5.1.1) and installed name vs store name (2.3.8). Metadata edits via `asc localizations update` work on versions waiting for review.
- A name mismatch needs a new build: set `CFBundleDisplayName` and `CFBundleName` to the store name, bump the build number, cancel the waiting submission, `asc review submit --build-id` (recipe in asc-status).
- Code classes (h, i, j, b) land on main and ship with the next planned release. Do NOT resubmit a healthy live app just for these.
- False positives to expect: check h misses plists not named `Info.plist` (Curbfind uses `Curbfind-iOS-Info.plist`); check l can read a localized string (Epiphany shows "English"); check e flags sidebars that are correct in a NavigationSplitView (Sidewise). Read the file before fixing.
- Check i only means something for resource types (plist, svg): xcodegen never bundles .md files. Excluding ExportOptions*.plist and icon.svg in the `sources: path: .` excludes is the fix.
- Check d: `SignInWithAppleButton` counts as Apple sign-in; look at the completion handler, a raw `localizedDescription` on `.failure` shows error 1001 when the person cancels.
- Never fix a finding by hiding the thing (the Apple button rule).

## History
2026-10-03 first run found: Windgate support, marketing and privacy URLs on the dead breathe domain, Notate marketing URL on a dead echo domain, Charblock installed as Charwork, Plaintxt installed as Plain, stale What's New in 6 apps, repo files bundled in Epiphany, Healstack, Sparkjar and Talli, encryption flag missing in 9 repos, 4.8 risk in Costanza and Homeward to verify.
