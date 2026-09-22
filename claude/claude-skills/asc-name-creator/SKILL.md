---
name: asc-name-creator
description: Brainstorm and verify App Store app name candidates, checking real-time availability against Apple's exact-match namespace using asc. Also covers brand, company and OS naming with bulk domain checks (domains.sh). Use when an app name is taken, when naming a company, product or OS and hunting for a free domain, when naming/renaming an app for the App Store, or when asked to find an available app name.
---

# ASC Name Creator

App name availability is exact-match, per-account, and *not* reflected in search results — a name can look free in `asc apps public search` and still be rejected as a duplicate (confirmed: "Sparkboard" had no search hit and was still rejected). Every public checker (namecheckly, checkappnames, appdrift) just queries the iTunes Search API, so they're all wrong the same way. The only truth is attempting the rename and reading Apple's response.

`probe.sh` does that **against a throwaway app record**, so the check is free and repeatable — the real app is never touched until the user picks a name.

## Preconditions

- `asc auth token --confirm` works.
- A throwaway ASC record to probe against. Default is `6783501927` (Lexly Mac — the duplicate record slated for deletion). `probe.sh` refuses to run against anything with a version in READY_FOR_SALE / IN_REVIEW / WAITING_FOR_REVIEW / PENDING_*.
- **If the default throwaway record is gone** (confirmed 2026-09-14: `6783501927` was deleted per `feedback_lexly_one_record`) and no other safe non-live record exists, fall back to probing directly against the real target app with `asc apps rename`. This is safe when the app being renamed *is* the actual rename target: each attempt is instantly reversible, costs nothing but an API call, and the app's own listing is what you're about to change anyway. Don't do this against an app you're not actually renaming.

## Workflow

### 1. Brainstorm ~20 candidates

Probing is cheap now, so go wide.

- **Single word by default.** Do not propose multi-word/compound names ("Briefkeeper", "Case File") unless the user says two words are fine.
- **Vary roots, not suffixes** — don't submit Spark/Sparkly/Sparker; mix in unrelated roots so one rejection doesn't kill the batch.
- If the user gives themes ("law-inspired", "something nautical"), root *every* candidate in them and don't drift to generic startup filler after rejections. Ask for themes up front if the app's domain doesn't make good candidates obvious.
- **Keep the metaphor, drop the ugly word.** If the old name's underlying concept was right (a browser named after a dormer window), stay in that semantic family instead of jumping to something unrelated — a rename should read as "same idea, better word," not a random pivot. Confirmed 2026-09-14: Lucarne (French, dormer window, but ugly/unfamiliar to English speakers) → tried Fenster (German) → landed Janela (Portuguese, "window") for the same WebKit browser app, after the user vetoed Fenster live for sounding "too angry a language for a nice browser" — language/sound register matters as much as meaning. Softer Romance/Nordic/Japanese words (Janela, Ikkuna, Gluggi, Dirisha) read friendlier in English ears than Germanic ones for a "nice" consumer app; reserve harder-sounding languages for apps that want to sound serious/technical.
- Never propose generic startup-filler roots (Spark-, Flow-, Hub-, -ly, -io) as a default. They read as AI-generated. Only reach for them if the user explicitly likes that register.
- **Common English words (especially exploration/adventure ones) are a dead namespace for anything browser-adjacent.** Confirmed 2026-09-14: Voyage, Nomad, Scout, Trek, Compass, Atlas, Horizon, Roam, Odyssey, Sojourn, Ramble, Meander, Foray, Rove, Venture, Jaunt, Pilgrim, Trekker — every single one was TAKEN, even the odd/oblique ones. If the user cites an Apple product name as inspiration (e.g. "I like that Safari is simple"), that specific naming *register* (short, evocative English noun) is almost certainly saturated on iOS already; foreign-language or invented words clear far more often than trying to out-simple Apple. Don't burn more than ~10 candidates confirming this before steering back to a less contested register.
- **Don't fully propagate (step 6) after every single landed name if the user is still iterating.** If they say "keep looping" / "find something better" / react to a landed name without explicitly confirming it, just apply the ASC rename (step 5) and report it back — hold the full file/repo/DNS propagation until they stop asking for alternatives (an explicit "that's the one," "ship it," or a judgment call you're making on their behalf per "you decide"). Propagating fully after each of 3-4 rounds wastes real work when only the last one sticks.

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

## Brand, company and OS names (domains)

For a company or product name rather than an App Store title, the namespace that matters is the domain. `domains.sh` checks a whole batch at once and prints only what looks free:

```bash
./domains.sh koinoki koibon treekoi              # bare .com
TLDS="computer systems" ./domains.sh joshuatree  # extra TLDs too
ALL=1 ./domains.sh matsu                         # show taken and unknown as well
```

What a day of checking 200+ names taught (2026-09-20):

- Every real dictionary word has its bare .com taken, in any language. Do not spend checks on them; say so up front.
- Every pronounceable coinage of five letters or fewer is squatted too. Start coining at six letters and go up from there.
- Three shapes that still have room: six to eight letter blends of two words the user likes (koi + "no ki" = Koinoki), the "Name Computer" or "Name Labs" company form (how Apple Computer started), and a real word on a fitting TLD (`.computer`, `.systems`).
- Joshua dislikes the `-os.com` suffix and wants a company-grade bare .com. Never propose `nameos.com`.
- Check collisions inside computing before pitching. Known burns: Bonsai is PrismML's LLM, Koi Computers sells HPC hardware, Flint OS and Koa.js exist, macOS used Mojave, Sequoia and Sonoma.
- Rank candidates against the user's own anchors and lead with one pick. Taste so far: likes Bonsai and Koi (short, Japanese, a living thing you can draw as an emblem), hard consonants, a vowel ending. Matsu and Tupelo were "okay". Yucca, Agave and Rowan were rejected as too soft.
- whois and DNS are signals only. Always say a name is unconfirmed until a registrar check and a trademark search are done.
