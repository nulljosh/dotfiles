---
name: summarize-books
description: Summarize photographed book chapters from iCloud, sync to books site, push live. Replaces summarize.sh — uses Read tool directly so no subprocess, no iCloud eviction issues.
model: haiku
---

# summarize-books

Photographed book chapters in iCloud → `summary.md` per chapter → merged per book → synced to books site → badges added → committed and pushed.

## Usage
```
/summarize-books              # process all pending books
/summarize-books "Newton"     # process one specific book
```

## Paths
- iCloud books: `~/Library/Mobile Documents/com~apple~CloudDocs/Documents/Misc/Books/`
- Books repo: `~/Documents/Code/bookrank/`
- Books site: `books.heyitsmejosh.com` (GitHub Pages, `nulljosh/bookrank`)

## Step-by-step

**1. Discover pending chapters.** List chapter subdirs (numeric names like `1`, `2`, `4`, `1-3`, `4-6`) for the target book(s); skip any with an existing `summary.md`. `ls "$BOOKS/<BookName>/"`.

**2. Read and summarize each pending chapter.**
1. List image files (HEIC, JPG) sorted by filename with `find "$dir" -maxdepth 1 -iname "*.HEIC" -print0 | sort -z` piped into `while IFS= read -r -d '' f; do ... done` — never a `for` loop over `ls` output; macOS `ls` here quotes filenames with spaces using literal embedded quote characters that break globbing.
2. HEICs over ~256KB fail the Read tool's size limit — convert first: `sips -Z 1500 -r -90 -s format jpeg -s formatOptions 45 <src.HEIC> --out <dest.jpg>` (to a scratch dir, not back into the source folder). Batch ~25 images at a time for large chapters. These settings (`-Z 1500 -r -90 formatOptions 45`) give legible pages at ~180-245KB each — the best token/legibility tradeoff found so far.
3. Read each converted JPG with parallel Read calls in one message (several per message beats one image per turn).
4. Write a thorough `summary.md`: chapter heading (`# Chapter N: Title`), section-by-section breakdown, key definitions/concepts, examples/tables (markdown), key takeaways. For a page with a photo/illustration/diagram (not just text), add a one-sentence description inline or under a small "Photos in this chapter" list (e.g. "Photo: Jobs waving to a crowd at the iPad 2 launch, March 2011") — text description only, never save/embed the image.
5. Write to `<chapter_folder>/summary.md`.
6. **Validate before anything downstream runs**: file must have a `#` heading, be >1500 chars, and be ≥250 chars per source image in that chapter. Fail → don't write it, note the failure, move on. This bar exists because the previous 300-char-flat check caused real data loss on 2026-08-17: a budget-starved run wrote four ~700-byte stubs for AI in Business ch 11-14, they passed, and step 7 deleted the source HEICs — those chapters are gone, unrecoverable without re-photographing. Deleting originals is irreversible, so the gate must be stricter than "did it write something": a genuinely short chapter still clears 250 chars/image, a token-starved stub won't.
7. Only after a successful write, delete the source HEICs (and any JPGs converted from them, not pre-existing original JPGs): `rm <chapter_folder>/*.HEIC`.

**3. Merge into book summary.** Concatenate all `chapter_dir/summary.md` (sorted) into `<book_folder>/<slug>-summary.md`, chapters separated by `---`. Slug = book name lowercased, non-alphanumeric → `-`, trimmed.

**4. Sync to Supabase (auth required since 2026-08-19).** Summaries are private, per-account rows in the shared spark project (`tjsxsqlxjmanwvmywwvw`, table `bookrank_summaries`, owner-only RLS) — no longer committed, `summaries/` is gitignored and history purged, the repo is a staging dir only. Owner: trommatic@icloud.com.
```bash
cd ~/Documents/Code/bookrank
./sync-summaries.sh                                   # iCloud <book>-summary.md -> summaries/<slug>.md (shrink-guarded)
python3 scripts/import-summaries.py --pat <slug> ...  # upsert only the slugs you touched
```
`--pat` is headless — reads the Supabase Management PAT from macOS Keychain (`security find-generic-password -s "Supabase CLI" -w`) and upserts as owner via SQL, bypassing RLS, no password prompt, never ask Joshua to log in. Without `--pat` the script prompts for the account password — the DEV creds in healstack/epiphany `.env.accounts.local` do NOT work on spark, never fall back to those.
Both steps refuse to overwrite with content under 80% of what's already stored (`FORCE=1` overrides). Expect `SKIP` on `the-optimist` — the iCloud copy (304KB) is stale, the DB row (498KB) is real; leave it. Verify via the `SKIP`/`upserted` lines per slug, or check library.html signed in.

**5. Add the book badge.** `rankings.html`/`book_rankings.md` are generated from `books.json` by `scripts/build.py` — never hand-edit them. Add/update:
```json
{ "title": "<Book Name>", "author": "<Author>", "cover": null, "linked": true, "badge": true, "section": "summary" }
```
`badge: true` renders a link to library.html (no per-book summary page anymore, every badge points to the signed-in library). Then `python3 scripts/build.py && python3 scripts/test-build.py`.

**6. Commit and push**
```bash
cd ~/Documents/Code/bookrank
git add books.json rankings.html book_rankings.md
git commit -m "Add <Book Name> summary badge"
git push
```
Never `git add summaries/` (gitignored anyway). Cloudflare Pages deploys from the push.

## Usage budget (mandatory)
Every `UserPromptSubmit` hook line prints `[usage] session N% | weekly_all N% | weekly_scoped[...] N%` — read it every turn.
- Stop reading new images once session usage passes 85% or any weekly figure passes 90%. Finish the chapter already in context, write its summary, write pickup notes to `ROADMAP.md` (exact resume folder + filename), stop.
- Never start a chapter you can't finish inside budget — a chapter left with its HEICs intact is free to resume, a stubbed one gets deleted and is gone.
- Hook line missing → run `~/.claude/scripts/usage.sh` before each new chapter.

## Token efficiency (learned from real runs)
- Shrink images aggressively: `-Z 1500 -r -90 formatOptions 45` — legible text, tokens drop noticeably. Biggest lever since image tokens dominate cost.
- Batch parallel Read calls, 4-8 images per message.
- Write `summary.md` incrementally for large chapters — extend with Edit after each sub-batch rather than one giant Write at the end, so an interruption doesn't lose already-summarized content.
- Chapters over ~40 images: treat as multiple resumable passes (note exact resume filename in ROADMAP.md) rather than one uninterruptible read — this recurs often enough that resumability beats finishing a whole book in one sitting.
- Don't re-read front matter (cover, TOC, "About This Book") across a series once you've seen the pattern — a quick skim for title/author/chapter list is enough.

## Notes
- **Model: Haiku** — OCR-style page reading + templated summarization, not hard reasoning. Bump to Sonnet only if a book needs deeper synthesis (technical/math-heavy chapters where Haiku's quality visibly degrades).
- Don't use `summarize.sh` — it spawns `claude -p` subprocesses that burn session tokens waiting. Read tool is faster and handles iCloud-evicted files correctly.
- Empty chapter folder → skip, log a warning. Validation failure → write `summary.failed.md`, don't delete originals.
- Never let a low token budget shorten a summary that's about to trigger deletion — if running out of budget, stop and report remaining chapters with originals intact.
- Write original notes, don't reproduce the book — near-verbatim reproduction of long stretches trips an output content filter and kills the run mid-chapter (hit four times on 2026-08-17, macOS Tahoe). Paraphrase, 250-500 words/chapter, capture the practical layer (steps, menu paths, shortcuts) — study notes, not a reprint.
- Books folder also holds one-level-nested series dirs (`for dummies/<book>/`) — `sync-summaries.sh` scans both depths.
- Chapter folders sometimes named by page range (`41-60`) or `intro`/`Intro`/`book` — treat any subfolder with images and no `summary.md` as pending.
- ML for Dummies `1-3` may have iCloud-evicted images — Read tool should handle it; if still unreadable, report which files failed.
