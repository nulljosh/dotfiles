---
name: launch
description: Build and push a launch kit for one or more apps under ~/Documents/Code — Product Hunt post (tagline, description, first comment, gallery), landing-page SEO/OG check, App Store listing sanity, Hacker News / Reddit / X copy — all sourced from the repo's own README, WHITEPAPER, metadata and screenshots. Use when the user says /launch, "launch <app>", "product hunt", "publish kit", "SEO for <app>", or wants to promote an app that is live.
---

# launch

`/launch <app> [<app>...] [--all] [--ph] [--seo] [--dry] [--ph-url <url>]`

- `<app>`: repo dir name under `~/Documents/Code` (voxprint, epiphany, curvely...). `--all` = every
  row in `~/Documents/Code/GTM.md` ledger that is live somewhere (web URL or ASC READY_FOR_SALE).
- `--ph`: also open the Product Hunt "new post" form in Chrome and prefill it (Joshua clicks Submit).
- `--seo`: only run the landing-page SEO/OG audit + fix, skip the PH kit.
- `--dry`: build `launch/` and report, don't commit or open Chrome.
- `--ph-url <url>`: the post is live; record it as `Post: <url>` in `launch/producthunt.md` and badge the README.
- Default (no flags): build kit, fix SEO gaps, commit + push. Chrome only with `--ph`.

## Sources of truth (read, never invent)

| Fact | Where |
|---|---|
| Name, one-liner, live URL, App Store ID | `README.md` first 20 lines |
| Story / why it exists | `WHITEPAPER.md` |
| App Store description, keywords, subtitle | `metadata/app-info/en-US.json`, newest `metadata/version/*/en-US.json`; fallback `fastlane/metadata/` |
| Price / rail / status | `~/Documents/Code/GTM.md` ledger row |
| Screenshots | `screenshots/` (prefer `screenshots/appstore/`, then `screenshots/*.png|jpg`) |
| Icon | `icon.svg` / `icon.png` / `Assets.xcassets/AppIcon.appiconset/*1024*` |

Missing screenshots → run `/screenshot-refresh <app>` (web) or `/appstore-screenshots` (iOS) first.
Missing live URL → stop and report; don't launch a dead page.

## Steps per app

1. **Collect** the table above into memory. Verify the live URL returns 200 (`curl -sI`).
2. **Write `launch/` in the repo** (one folder, plain text, in the house voice — see
   `~/Documents/Code/README-TEMPLATE.md`, `[[feedback_house_writing_voice]]`):
   - `producthunt.md`: name (≤40), tagline (≤60 chars, no "the ultimate", no emojis), description
     (≤260 chars), topics (3), first comment (maker story, 150–250 words, from WHITEPAPER, ends
     with what's paid and what's free per GTM rail), pricing line, links (web, App Store, GitHub).
   - `hn.md`: "Show HN: <Name> – <one-liner>" title (≤80) + 3–5 sentence body.
   - `reddit.md`: one title + body per fitting subreddit (r/SideProject always; r/iOSProgramming,
     r/macapps, r/privacy etc. only if truly fitting).
   - `x.md`: one thread, 3 posts max.
   - `gallery/`: hard-link or copy the best 3–5 screenshots, renamed `01-*.png`. PH wants
     1270×760 or 3:2 for the first image; if only phone shots exist, compose 3 phone frames on a
     `--bg` token-coloured 1270×760 canvas with `sips`/ImageMagick (installed) — no new tooling.
   - `checklist.md`: what Joshua still does by hand (PH Submit, pick launch day, hunter).
3. **SEO / OG audit of the landing page** (`curl -s <url>`): `<title>` (≤60), `<meta name=description>`
   (50–160), `og:title`, `og:description`, `og:image` (absolute URL, 1200×630, exists → `curl -sI`),
   `twitter:card=summary_large_image`, canonical, `<html lang>`, a `sitemap.xml`/`robots.txt` that
   200s. Fix gaps in the repo's landing source (`web/index.html`, `index.html`, or the framework
   head), reusing the PH tagline/description. Generate `og.png` from the first gallery image if
   absent. Deploy per `[[feedback_deploy_target_cloudflare_first]]`.
4. **App Store listing sanity** (only if an ASC ID exists): `asc versions list --app <id> --output json` → newest version, then `asc validate --app <id> --version <v> --output json`;
   subtitle + promotional text present, ≥3 screenshots per device family, keywords ≤100 chars.
   Report gaps; fix promotionalText via `asc localizations update --id` (see
   `[[reference_asc_promotional_text_live]]`). Never touch price or availability here.
5. **README badge**: `python3 ~/.claude/skills/launch/badge.py <app> [<url>]`. Reads the `Post:` line in
   `launch/producthunt.md` (or `--ph-url`), appends a shields.io Product Hunt badge to the README badge
   row, commits `readme: Product Hunt badge`. No URL yet = skipped, never a placeholder link.
   `badge.py --all` sweeps every repo, badging only those whose `launch/producthunt.md` already has a
   `Post:` line — use it after any new app's PH post goes live instead of naming apps one by one.
6. **Commit + push** (`launch: kit + seo for <app>`), per `[[feedback_auto_push]]`.
7. **`--ph` only**: open `https://www.producthunt.com/posts/new` in Chrome (claude-in-chrome),
   paste name/tagline/description/topics/links, upload `launch/gallery/*` via `file_upload`, stop
   at the Submit/Schedule button. Joshua clicks it. Same rule as `[[feedback_card_gated_apis_autofill]]`.

## Mechanics

`python3 ~/.claude/skills/launch/mech.py <app> <url> <tagline> <description>` does gallery, og.png,
meta injection, robots/sitemap, deploy, commit, push and prints one JSON line. Claude writes the
copy files first. Verified 2026-09-09 across 12 apps, lessons baked in:
- Landing source order: `docs/`, `landing/`, root, `web/`. But the SERVED page is often
  `dist/index.html` (wrangler `pages_build_output_dir = "dist"`): run `npm run build` if a build
  script exists, then inject into `dist/index.html` and copy og.png/robots/sitemap into `dist/`
  before `wrangler pages deploy`. Vite Workers (epiphany): put the files in `public/`.
- Repos with `scripts/deploy.sh` (lexly) or `deploy.sh`: run that, nothing else.
- Worker landings with no index.html (sidewise): kit only, report SEO as skipped.
- Check `og_live` is `image/png`; `text/html` means the SPA fallback caught it and the file is
  not where the deploy reads from.

## Rules

- One app = one `launch/` folder, one commit. `--all` loops; failures don't stop the loop, they
  go in the final table.
- Copy is prose, never bullet walls, no em dashes, no emojis, no "seamlessly/leverage/delve".
- Launch order and rails come from GTM.md, don't re-decide them. Free apps get "Free" in the
  pricing line; $1 IAP apps say exactly what the dollar buys.
- Don't create PH posts unattended, don't post to HN/Reddit/X at all — the files are drafts.
- Skip an app if its store status is REJECTED on every platform and it has no web URL.

## Report

One table: app · kit ✓ · SEO fixes (n) · ASC gaps (n) · PH badge (y/n) · PH prefilled (y/n) · link to `launch/`.
Then the recommended launch order copied from GTM.md. Under 8 words if only one app and all green.
