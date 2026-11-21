---
name: summarize-books
description: Turn a PDF of a book Joshua owns into chapter summaries in his Kernel account. Use for "/summarize-books <Book>", "import the book", "summarize the book", or any book folder under iCloud Documents/Misc/Books.
---

# Import a book from its PDF

No more page photos (Joshua, 2026-11-15: "We're gonna stop scanning books and instead just get the PDFs"). Books live in `~/Library/Mobile Documents/com~apple~CloudDocs/Documents/Misc/Books/<Book>/` as one PDF each.

Two routes, same result:
- **In the app.** Kernel's Add a book (iPhone, iPad, Mac, web) imports a PDF or EPUB and summarizes each chapter through `/api/summarize` by default. Scanned PDFs are read on the device in the apps. This is the route for every user, and the easy one for Joshua too.
- **From here** (long books, or when the app route fails): the steps below.

## Output is always a summary

Every book gets a summary in Claude's own words. No word-for-word transcription. `#` per chapter, 3 to 6 short headed key ideas, then a "Takeaways" list. Plain English, no em dashes, no quotes over 10 words, no copied code listings. Figures become one bracketed line, e.g. `[Figure 4.2: request flow through the cache]`.

## Steps

1. **No PDF yet?** Check legit free sources and tell Joshua if one exists: Open Library / Internet Archive borrow, Project Gutenberg and Standard Ebooks, the author's or publisher's site (No Starch, O'Reilly, Manning sell DRM-free PDFs; OpenStax and arXiv are free). Never search for, fetch or link pirate copies or shadow libraries. Joshua supplies the PDF; where it came from is his call.
2. **Text layer?** `pdffonts book.pdf | sed -n 3p` prints a font row only if there is text. An image-only PDF: import it in the iPhone or Mac app (on-device OCR), or OCR pages here with `ocr.sh` after `pdftoppm -r 150 -jpeg`.
3. **Split by chapter, locally.** Read the contents (`pdftotext -f 5 -l 12 book.pdf -`), find where chapter 1 starts for the offset, then `pdftotext -f <start> -l <end> book.pdf <scratch>/chN.txt` per chapter. Zero tokens so far.
4. **Summarize one chapter file at a time** into `~/Documents/Code/kernel/summaries/<book-slug>.md`, appending after each so nothing piles up in context. Long books go to one Haiku subagent with this exact brief.
5. **Import** from `~/Documents/Code/kernel`: `python3 scripts/import-summaries.py --service <book-slug>` and check the uploaded byte count. That writes Joshua's private rows only. Never run `sync-summaries.sh` on a PDF-sourced book.
6. Add or refresh the book's line in the Books `CLAUDE.md`. Keep the PDF in iCloud Books; never copy it into a repo or upload it anywhere else.

## Photos are never ingested

PDF first, always. Photos are only a fallback for a book Joshua could not find as a PDF (Joshua, 2026-11-16). If a folder has a PDF, delete its photos unread. If it has only photos, OCR them with `ocr.sh`, summarize just the missing chapters, then delete the photos. Remove empty folders after.

## Find the work

Walk every folder with a PDF. A book is done when `~/Documents/Code/kernel/summaries/<book-slug>.md` exists (or the folder has a `summary.md` / `<book-slug>-summary.md`). Image-only `chapter.pdf` files from the old flow already have their `summary.md`; skip them. Everything else with a text layer is work.

```sh
find . -iname '*.pdf' | while read -r f; do echo "$(pdffonts "$f" | sed -n 3p | wc -l) $f"; done
```

Split by outline with qpdf when the PDF has one (`qpdf --json --json-key=outlines`, the chapter is the level under each "Part"), else by the contents page.

## Report

Headless. One line: chapters done, chapters missing, import result.
