---
name: oeis
description: Work Joshua's OEIS submissions (noema). Check the draft queue and OEIS server mail, fix and propose drafts, submit the next queued sequence when a slot opens, and find new sequences worth submitting. Use for /oeis, "check oeis", "OEIS edit", "propose the draft", "new sequence", or any mail from oeis.org.
---

# OEIS

Account: Joshua Trommel. Source texts live in `~/Documents/Code/noema/docs/OEIS-*.md`; data in `noema/cs/`. Repo links must point at github.com/nulljosh/noema. Never touch Joshua's other Safari tabs: open a new one to edit.

## 1. Read state (curl, no login)
- Queue: `https://oeis.org/draft?user=Joshua%20Trommel`. Max 3 pending edits.
- One draft: `curl -s https://oeis.org/draft/A######` and strip tags. The Discussion block holds editor comments (Sean A. Irvine, Michel Marcus, Jason Yuen) and the status flips (editing, proposed).
- Mail from `wiki-noreply@oeis.org`: replies to it are discarded. Answer on the sequence page, never by mail. Read via `/usr/bin/osascript ~/.claude/skills/mail-ingest/mail.scpt read oeis`.

## 2. Edit rules (editors reject on these)
- Every comment self-contained: no "this list", no "the above". Name the thing.
- Consecutive comments by us are one block with one signature at the end: `- Joshua Trommel, Mon DD YYYY`.
- Extend DATA to the full proven term count, replace the b-file when terms grow, keep the b-file link text `Table of n, a(n) for n = 1..N`.
- Disclose AI help in the Discussion box, and say how results were checked (second program, rerun from blank).
- Keyword `more` stays unless the sequence is complete. Do not add `changed` by hand.

## 3. Propose
A draft sits at `editing` until someone clicks "These changes are ready for review by an OEIS Editor." The server mails a nag after a week idle. Fix what the editor asked, reply in Discussion, then click that button. Then curl the page to confirm status `proposed`.

## 4. Free slot -> next sequence
Queue in `noema/docs/LOOP-HANDOFF.md`: A332718 (rule 110), runtime spectrum (new, via `edit?seq=A999999999&internal=1`), A332717 b-file (file input on the edit page), Ising 3x3 and 4x4 rows. Texts are ready in the docs. Save only after confirming the draft is not already open.

## 5. Find new ones
A sequence is worth it only if the terms were computed here, rerun by a second implementation, and a search of the first 8 terms on oeis.org returns nothing. Search with `https://oeis.org/search?q=1,2,3&fmt=text`. Candidates come from each noema lane's `roadmap.md` Frontier.

Log every submit, comment and status change in `noema/ledger.md` and the roadmap CS line.
