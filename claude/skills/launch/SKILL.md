---
name: launch
description: Build and push launch kits for apps under ~/Documents/Code, read the user's Product Hunt launches and public product pages, and prepare Product Hunt, HN, Reddit, X, and directory posts. Use for /launch, Product Hunt account or product data, SEO, or promotion of a live app.
---

# launch

`/launch <app> [<app>...] [--all] [--ph] [--hn] [--reddit] [--seo] [--dry] [--ph-url <url>]`

- `<app>`: repo dir name under `~/Documents/Code` (voxprint, epiphany, curvely...). `--all` = every
  row in `~/Documents/Code/GTM.md` ledger that is live somewhere (web URL or ASC READY_FOR_SALE).
- `--ph`: open the Product Hunt "new post" form in Joshua's normal Chrome profile and prepare the kit for entry. Prefill only when an authenticated browser tool works; Joshua reviews and clicks Submit.
- `--hn`: open `https://news.ycombinator.com/submit` in Chrome, prefill title + URL from `launch/hn.md`, stop at Submit.
- `--reddit`: for each `launch/reddit/<sub>.md` with no karma/flair gate open, open `https://www.reddit.com/r/<sub>/submit`,
  prefill title + body, stop at Post. One tab per subreddit, three at most per run.
- `--seo`: only run the landing-page SEO/OG audit + fix, skip the PH kit.
- `--dry`: build `launch/` and report, don't commit or open Chrome.
- `--ph-url <url>`: the post is live; record it as `Post: <url>` in `launch/producthunt.md` and badge the README.
- Default (no flags): build kit, fix SEO gaps, commit + push. Chrome only with `--ph`, `--hn` or `--reddit`.

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
   - `reddit/<subreddit>.md` + `reddit/checklist.md`: follow `<skill-dir>/reddit.md` (subreddit
     map, per-sub rules, karma/flair gates). One tailored post per fitting subreddit, never the same body twice.
   - `directories.md`: one short listing (name, one-liner, 2-sentence description, category, links) reused for
     the submit-once directories: AlternativeTo, Indie Hackers products, BetaList (pre-launch only), Uneed,
     SaaSHub, and dev.to (a build-story post, only when the WHITEPAPER has a real technical hook).
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
5. **README badge**: `python3 <skill-dir>/badge.py <app> [<url>]`. Reads the `Post:` line in
   `launch/producthunt.md` (or `--ph-url`), appends a shields.io Product Hunt badge to the README badge
   row, commits `readme: Product Hunt badge`. No URL yet = skipped, never a placeholder link.
   `badge.py --all` sweeps every repo, badging only those whose `launch/producthunt.md` already has a
   `Post:` line — use it after any new app's PH post goes live instead of naming apps one by one.
6. **Commit + push** (`launch: kit + seo for <app>`), per `[[feedback_auto_push]]`.
7. **`--ph` only**: prefer the ChatGPT/Codex Chrome extension in Joshua's regular signed-in profile. In the desktop app, select `@Chrome` for the task and allow Product Hunt access when prompted. Read `/my/products` first to avoid duplicate posted or scheduled launches. Run `python3 <skill-dir>/producthunt.py prepare <app>` to open the normal Chrome profile and show fields from `launch/producthunt.md`. Fill name/tagline/description/topics/links and upload `launch/gallery/*`; stop at Submit/Schedule. If browser control is unavailable, leave the prepared fields and gallery paths for Joshua to enter in Chrome. Joshua reviews and clicks Submit. Same rule as `[[feedback_card_gated_apis_autofill]]`.

## Product Hunt data

Prefer the Chrome extension on `/my/products` for the full product and launch state. Run `python3 <skill-dir>/producthunt.py list` when browser control is unavailable, or `page <product-url>` for a public page. The helper reads a `PRODUCTHUNT_TOKEN` environment variable or the macOS Keychain item `producthunt-api`. Product Hunt's [API docs](https://www.producthunt.com/v2/docs) describe a personal developer token for scripts; save it to Keychain locally, never in a repo or chat. With a token, `list` pages through the authenticated user's `madePosts`. This is launches, not necessarily every claimed Product Page. Without a token, it scans existing `launch/producthunt.md` links and verifies `nulljosh1` as maker on each public page; report that list as incomplete. Public profile requests may hit Cloudflare, and headless Chrome will not solve an account challenge. Do not present a challenge page as product data. Read access is sufficient here.

### Missing-from-PH scan (verified 2026-10-26)

Goal: shipped apps with no Product Hunt product. Order: (1) Chrome extension on `/my/products`; (2) if it says "not connected", Safari is already signed in: `osascript` a new tab to `https://www.producthunt.com/my/products`, wait 6s, `do JavaScript "document.body.innerText"` on `last tab of window 1` (store the result in a variable not named `r`), then close that tab. Read-only, never click Manage. Public profile and `producthunt.com/@nulljosh1` return 403 to curl; no token means `producthunt.py list` is incomplete.
Diff the Products list against `~/Documents/Code` repos that have a live URL (`curl -sI`) or a store listing. PH keeps the OLD product name, so map renames first: Inkpress=Bugle, Quotestreak=Coda, Lexly=Patois, Sparkjar=Melete, NYC Survive=Gastown, Intake=Machaon, Curvely=Pan, Notate=Echo. Skip private (Temida, Homeroom) and nothing-live apps.
Corrections: Icelus is Blockframe renamed (already on PH under the old name, rename it there, do not re-post); Conveyer merged into Surf; Surf's README calls itself a personal study that breaks Duolingo's terms, so it is not posted. Last scan: 21 products, 20 posted + Intake scheduled Oct 27. Not on PH, live web: Horula, Icelus, Surf, Vancouver Vice, Atlin, Mailbag, Conveyer. Store-only or unclear: Cartons, Hermes, Airwell, Hamurapi.
Kit state: launch/ already exists (no `Post:` line, so ready to submit) for Horula, Icelus, Mailbag, Airwell. No kit yet: Surf, Vancouver Vice, Atlin, Conveyer, Cartons, Hermes, Hamurapi. Check `ls <app>/launch` before building so a kit is never rebuilt.

### Submitting to Product Hunt through Safari (verified 2026-10-26, no Chrome extension needed)

`python3 <skill-dir>/ph_submit.py <app>` creates the draft at `/posts/new`, fills name, tagline, description, gallery, GitHub link, categories, pricing, tags and first comment, then schedules it. Copy and fill `ph_apps.py` first (one dict per app, copy from `launch/producthunt.md`). It works in the window that already has a producthunt.com tab (open one first), reads state from page text, and stops with `NOT READY` if the "Before you launch" panel does not say "ready to schedule". Details learned the hard way:
- Scripts find the PH tab by URL, never "last tab". Joshua uses the same Safari; new windows and his tabs shift. Never click by bare text outside a dialog: a stray click on "Productivity" opened a sponsored ad tab.
- A fresh domain on jaybulb.com matches an existing product ("Is this a new launch for Bookrank?"): pick "No, it's a different product".
- Logo auto-fills from the site's icon sometimes. If "Logo Incomplete", paste a 240px+ PNG URL (raw.githubusercontent.com of `brand/icon-1024.png` works for public repos). Gallery takes a URL too (site og image, 1200x630 is fine).
- "Paste a URL" is sometimes a native prompt that freezes Safari's JavaScript (any `do JavaScript` call hangs). Detect it by a hung call, then type the URL with System Events and press Return. Other times it is an inline input plus an Add button. The driver handles both.
- Maker radio: the "I made this" one is value `true`. Launch date: one per weekday, 12:01 AM PT, up to 30 days out; Confirm scheduled date finishes it.
- Headless? Checked 2026-10-26, not cleanly. The public API (v2) cannot create posts. The site's own `/frontend/graphql` uses persisted-query hashes (no operation text in the JS bundles), so a replay needs hashes captured from live traffic, and a `fetch` hook added after load sees nothing because Apollo keeps its own reference. Headless Chrome and curl get a Cloudflare 403 and the login is Joshua's step; lifting cookies out of Safari is credential extraction, so no. The Safari driver is the practical version: no clicks from Joshua, about two minutes per app, but the PH tab must be the selected tab of its own window (background tabs hang `do JavaScript`). Before it navigates, wait for "Saving..." to clear or Safari asks "Leave this page?" and freezes the run; Escape picks Stay on Page.
- Done 2026-10-26: Horula Oct 28, Mailbag Oct 29, Airwell Oct 30, Atlin Nov 2, Cartons Nov 3, Hermes Nov 4, Hamurapi Nov 5, Vancouver Vice Nov 6. `/my/products` after: 20 posted, 9 scheduled (with Intake Oct 27), 0 drafts.
- Skip private apps and anything whose README says it is not a product. Never create two drafts for the same app: reuse the draft URL (pass it as the second argument).

### Keeping Product Hunt pages current (renames, pricing, images; verified 2026-10-26)

PH keeps whatever name, URL and logo the product had at launch, so every rename leaves a stale page. After any rename (see the `rename` skill) or price change:
1. `python3 <skill-dir>/ph_audit.py` reads every product's edit page (`/products/<slug>/edit`). Slugs never change on rename (inkpress is Bugle, quotestreak is Coda, lexly is Patois, sparkjar is Melete, nyc-survive is Gastown, blockframe is Icelus, healstack is Machaon), so match by slug, not name.
2. Compare against truth: name and URL from the repo README and live `<title>`, tagline and description from the live page's og tags, pricing from GTM.md. PH pricing: `free` when everything is free, `free_options` when the web app is free and the store app or an IAP costs money, `payment_required` only when nothing is free.
3. Edit `REN` and `PRICING` in `ph_fix.py`, run `python3 <skill-dir>/ph_fix.py <slug>...`. It sets the fields, picks the pricing radio, pastes the logo URL (`brand/icon-1024.png` on raw.githubusercontent.com; labs apps live under `labs/main/<app>/`) and clicks Save changes. Rerun `ph_audit.py` to confirm.
4. A scheduled launch has its own name and tagline on `/posts/<slug>/edit`. Fix that too before launch day.
- Only ONE script may drive the PH tab at a time. A leftover audit loop and a fix run raced on 2026-10-26 and each read the other's page. Before starting, `pgrep -f "ph_|readall|fix.py"` must print nothing.
- Hold a rename on PH until the store listing has it (Notate stays until Apple accepts Echo, Curvely until the Pan listing clears).
- Gallery: `ph_gallery.py <slug>` adds one current image by URL (site og image, or a fresh 1270x760 headless Chrome shot of the live site committed to `launch/gallery/00-live.png` and served from raw.githubusercontent.com), removes the old tiles (`[data-test=gallery-media-remove]`) and saves (`[data-test=product-edit-submit]`). Check the og image is really an image first: `curl -sI` must say `image/`, not `text/html` (Coda and Melete og.png were SPA fallbacks on 2026-10-26).
- Never type with System Events: Joshua is usually typing in another app and the keystrokes land there. "Paste a URL" prompts are answered through accessibility instead (`ax_prompt` in ph_submit.py sets text field 1 of group 1 of tab group 1 of splitter group 1 and clicks OK).
- Other Claude sessions share this Safari. Work in a window of its own (`make new document`), never in a tab next to someone else's: a background tab hangs `do JavaScript`.
- Product pages for Curbfind and Plank redirect to their launch page; their pricing lives there and was already Free.

## Mechanics

`python3 <skill-dir>/mech.py <app> <url> <tagline> <description>` does gallery, og.png,
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
- Nothing is ever submitted unattended. PH, HN and Reddit are prepared in Chrome and stop at the button;
  Joshua clicks. X and the directories stay drafts. Self-promo bans on HN and Reddit are account-wide and
  permanent, and one account pushing many apps at once is exactly what trips them.
- Pace it: one app per channel per week. `--all` builds every kit but never opens Chrome for more than one app.
- HN gets only apps with a technical story (on-device ML, a kernel, a novel algorithm). A thin utility on
  Show HN sinks and costs goodwill; write `hn.md` anyway, mark it `Skip: no technical hook` at the top.
- Skip an app if its store status is REJECTED on every platform and it has no web URL.

## Report

One table: app · kit ✓ · SEO fixes (n) · ASC gaps (n) · reddit subs (n) · HN worth posting (y/n) · PH badge (y/n) · prefilled (PH/HN/Reddit) · link to `launch/`.
Then the recommended launch order copied from GTM.md. Under 8 words if only one app and all green.
