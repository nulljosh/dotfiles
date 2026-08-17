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

### 4. Sync to books repo

```bash
cd ~/Documents/Code/spine && ./sync-summaries.sh
```

### 5. Add Summary badge in rankings.html

In `~/Documents/Code/bookrank/rankings.html`, find the `<div class="book-title">` for the book and add a badge link if not already present:

```html
<a href="summary.html?b=<slug>" class="badge">Summary</a>
```

Pattern (from Agentic AI entry):
```html
<div class="book-title">Agentic AI for Dummies <a href="summary.html?b=agentic-ai-for-dummies" class="badge">Summary</a></div>
```

Also update `book_rankings.md` in the same repo — add `[Summary](summary.html?b=<slug>)` next to the book title.

### 6. Commit and push

```bash
cd ~/Documents/Code/bookrank
git add summaries/ rankings.html book_rankings.md
git commit -m "Add <Book Name> summary + badge"
git push
```

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
- Optimist COMPLETE. AI in Business (ch 3-6, 15-17 done, ch 7-14 + stray image pending). macOS Tahoe (untouched).
- ML for Dummies `1-3` folder may have iCloud-evicted images — the Read tool should handle it; if images still can't be read, report which files failed.
