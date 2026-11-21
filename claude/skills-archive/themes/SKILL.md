---
name: themes
description: Read every book summary on Joshua's Kernel account and write one Markdown digest of each book's main themes, explained plainly. Use for /themes, "what are my books about", "themes across my books", or a reading digest.
---

# /themes

One digest of the main themes in every book Joshua has summarized. No new UI, no upload: a Markdown file he reads.

## Sources
- `~/Documents/Code/kernel/summaries/*.md` (gitignored, the same text that is on his Kernel account). Skip `_books-wip/`.
- If a book is missing there, its iCloud copy: `~/Library/Mobile Documents/com~apple~CloudDocs/Documents/Misc/Books/**/*-summary.md` (find with `find -iname`, never a zsh glob).

## Steps
1. List the books, one per file, by the `# Title` on line 1.
2. Per book, read the file in parts (big ones are 100 KB+): the headings first (`grep -n '^#'`), then the Takeaways / Key ideas / In short sections, then the opening paragraph of each chapter. Do not read every line of a long book.
3. Pull 3 to 5 themes per book. Each theme: a short bold name, then two or three plain sentences on what the book says about it, the way Kernel's key ideas read. In your own words, never long quotes.
4. End with "Across the shelf": 3 to 6 themes that show up in more than one book, naming the books.
5. Write `~/Library/Mobile Documents/com~apple~CloudDocs/Documents/Misc/Books/themes.md` with today's date at the top, newest run replacing the old one. Send it with SendUserFile.

## Rules
- House voice: plain words, no em dashes, no hype, no bullet walls where a sentence works.
- Private: never put the digest in a repo, a share link or the app bundle.
- Cost: a big shelf is many reads. Batch greps; one book at a time; no subagents.
