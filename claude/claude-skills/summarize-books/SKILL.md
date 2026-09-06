---
name: summarize-books
description: Summarize photographed book chapters from iCloud, sync to books site, push live. Replaces summarize.sh — uses Read tool directly so no subprocess, no iCloud eviction issues.
model: haiku
---

# summarize-books

Processes photographed book chapters in iCloud → writes summary.md per chapter → merges per book → syncs to books site → adds badges → commits and pushes.

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

### 1. Discover pending chapters

For the target book(s), list chapter subdirectories (numeric names like `1`, `2`, `4`, `1-3`, `4-6`).  
Skip any chapter folder that already has a `summary.md`.

Use Bash to list:
```bash
ls "$BOOKS/<BookName>/"
```

### 2. Read and summarize each pending chapter

For each chapter folder without `summary.md`:

1. List image files (HEIC, JPG) sorted by filename with `find "$dir" -maxdepth 1 -iname "*.HEIC" -print0 | sort -z` piped into a `while IFS= read -r -d '' f; do ... done` loop — **do not** use `ls` output in a `for` loop; macOS `ls` here quotes filenames containing spaces with literal embedded quote characters that break globbing.
2. HEICs over ~256KB fail the Read tool's size limit — convert first: `sips -Z 1500 -r -90 -s format jpeg -s formatOptions 45 <src.HEIC> --out <dest.jpg>` (write converted JPGs to a scratch dir, not back into the source folder, so cleanup stays simple). Do this in batches of ~25 images at a time for large chapters to keep context manageable. **Token efficiency**: `-Z 1500 -r -90 formatOptions 45` yields legible pages (~180-245KB each) without the illegible output or rotation issues of prior attempts.
3. Use the Read tool to read each converted JPG. To cut turns, issue several independent Read calls in one message (the tool supports parallel calls) instead of one image per turn.
4. Generate a thorough `summary.md` with:
   - Chapter heading (`# Chapter N: Title`)
   - Section-by-section breakdown
   - Key definitions and concepts
   - Examples and tables (markdown)
   - Photos/figures: if a page contains a photo, illustration, or diagram (not just body text), add a one-sentence description of what it shows (e.g. "Photo: Jobs waving to a crowd at the iPad 2 launch, March 2011") inline near the relevant section or under a small "Photos in this chapter" list. Don't save/embed the image itself — text description only.
   - Key takeaways
5. Write the file with the Write tool to `<chapter_folder>/summary.md`.
6. Validate: file must contain a `#` heading, be **>1500 chars**, and be **>=250 chars per source image** in that chapter. If not, do NOT write it — note the failure and move on.
   - **The 300-char bar that used to be here caused real data loss (2026-08-17).** An agent low on budget wrote four ~700-byte one-paragraph stubs for AI in Business ch 11-14, they passed validation, and step 7 then deleted the source HEICs. Those chapters are unrecoverable without re-photographing. A summary thin enough to be worthless still cleared the old check.
   - Deleting originals is irreversible, so the validation gate must be *stricter* than "did it write something". If a chapter is genuinely short, it will still clear 250 chars/image; a token-starved stub will not.
7. After successful write: delete the original HEIC files and any JPGs that were converted from HEICs (leave pre-existing original JPGs). Use Bash:
   ```bash
   rm <chapter_folder>/*.HEIC
   ```

### 3. Merge chapter summaries into book summary

After all chapters are done, concatenate all `chapter_dir/summary.md` files (sorted) into `<book_folder>/<slug>-summary.md`:

```
# <Book Name>

<chapter 1 summary>

---

<chapter 2 summary>

---
...
```

Slug = book name lowercased, non-alphanumeric replaced with `-`, trimmed.

### 4. Sync to books repo and upload to Supabase (auth required since 2026-08-19)

Summaries are **private, per-account rows** in the shared spark Supabase project
(`tjsxsqlxjmanwvmywwvw`, table `bookrank_summaries`, owner-only RLS). They are no longer
committed: `summaries/` is gitignored and git history was purged. The repo is only a staging
dir. Owner account is trommatic@icloud.com.

```bash
cd ~/Documents/Code/bookrank
./sync-summaries.sh                                   # iCloud <book>-summary.md -> summaries/<slug>.md (shrink-guarded)
python3 scripts/import-summaries.py --pat <slug> ...  # upsert only the slugs you touched
```

`--pat` is headless: it reads the Supabase Management PAT from the macOS Keychain
(`security find-generic-password -s "Supabase CLI" -w`) and upserts as the owner via SQL,
bypassing RLS. No password prompt, do not ask Joshua for his login. Without `--pat` the script
prompts for the account password; the DEV creds in healstack/epiphany `.env.accounts.local`
do NOT work on spark, so never fall back to those.

Both steps refuse to overwrite with content under 80% of what is already stored (`FORCE=1`
overrides). Expect `SKIP` on `the-optimist`: the iCloud copy (304KB) is stale, the DB row
(498KB) is the real one. Leave it.

Verify: `SKIP`/`upserted` lines per slug; the row also shows up in library.html when signed in.

### 5. Add the book to books.json (badge)

`rankings.html` and `book_rankings.md` are **generated** from `books.json` by
`scripts/build.py`; never hand-edit them. Add or update the entry in `books.json`:

```json
{ "title": "<Book Name>", "author": "<Author>", "cover": null, "linked": true, "badge": true, "section": "summary" }
```

`badge: true` renders `<a href="library.html" class="badge">Summary</a>` (there is no per-book
summary page any more, every badge points to the signed-in library). Then:

```bash
python3 scripts/build.py && python3 scripts/test-build.py
```

### 6. Commit and push

```bash
cd ~/Documents/Code/bookrank
git add books.json rankings.html book_rankings.md
git commit -m "Add <Book Name> summary badge"
git push
```

Never `git add summaries/` (gitignored anyway). Cloudflare Pages deploys from the push.

## Token efficiency (learned from repeated real runs)

- **Shrink images aggressively**: `-Z 1500 -r -90 formatOptions 45` — book text stays legible, tokens drop noticeably. This is the single biggest lever since image tokens dominate cost for this task.
- **Batch parallel Read calls** (already above) — 4-8 images per message beats one-at-a-time.
- **Write summary.md incrementally as you go for large chapters** (don't hold the whole chapter's text in your head to write once at the end) — extend the file with Edit after each sub-batch rather than one giant Write at the finish, so a mid-chapter interruption doesn't lose already-summarized content.
- **Checkpoint often on large chapters**: for any single chapter folder over ~40 images, treat it as multiple resumable passes (note exact resume filename in ROADMAP.md) rather than one uninterruptible read — this task recurs often enough ("a ton" of chapters over time) that resumability matters more than finishing a whole book in one sitting.
- **Don't re-photograph/re-read front matter** (cover, TOC, "About This Book") across a series' books once you've seen the pattern once — it's rarely worth full token spend, a quick skim for the title/author/chapter list is enough.

## Notes

- **Model: Haiku** — this is OCR-style page reading + templated summarization, not hard reasoning; Haiku handles it fine at a fraction of Sonnet's cost. Bump back to Sonnet only if a book's content needs deeper synthesis (e.g. technical/math-heavy chapters where Haiku's summary quality visibly degrades).
- **Do not use `summarize.sh`** — that script spawns `claude -p` subprocesses which burn session tokens waiting. The Read tool is faster and handles iCloud-evicted files correctly.
- If a chapter has no images (empty folder), skip it and log a warning.
- If summary validation fails, write `summary.failed.md` instead and do not delete originals.
- **Never let a low token budget shorten a summary that is about to trigger deletion.** If you are running out of budget, STOP and report the remaining chapters with their originals intact — a chapter left pending is free to resume, a chapter stubbed and deleted is gone forever.
- **Write original notes, don't reproduce the book.** Near-verbatim reproduction of long stretches of a copyrighted book trips an output content filter and kills the run mid-chapter (hit four times on 2026-08-17 with macOS Tahoe). Paraphrase into your own words, 250-500 words per chapter, capturing the practical layer — steps, menu paths, shortcuts. Study notes, not a reprint.
- Books folder also holds one-level-nested series dirs (`for dummies/<book>/`); sync-summaries.sh scans both depths.
- Chapter folders are sometimes named by page range (`41-60`) or `intro`/`Intro`/`book`; treat any subfolder with images and no summary.md as pending.
- ML for Dummies `1-3` folder may have iCloud-evicted images — the Read tool should handle it; if images still can't be read, report which files failed.
