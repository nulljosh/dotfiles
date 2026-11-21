---
name: brief
description: Read Joshua's own Litigate case files and give a short brief on the case at hand, its gaps and the next steps. Use for /brief, "summarize my case", "what's next on my case", or "where does my litigation stand". Optional argument picks a case (CASE-0001 to CASE-0004, or rcmp, family, muni, bylaw).
---

# /brief

Joshua's cases live in Litigate (litigate.jaybulb.com) under his account, behind row-level security. This skill
reads them once, locally, and turns them into a working brief. It is a planning aid, not legal advice; say so once
at the end, in one line.

## Privacy, before anything else
- Case content never leaves this machine: no artifact, no gist, no commit, no Notes, no wiki, no email, no memory file.
  The answer goes in the chat only.
- The pulled JSON goes in the session scratchpad, mode 600. Delete it when the brief is done.
- Never print the password or the access token.

## Steps
1. **Pull.** `python3 ~/.claude/skills/brief/pull.py <scratchpad>/brief.json`. It signs in once with the `.env`
   login and prints row counts. If sign-in fails, stop and tell Joshua to reset the password on the site and
   update `BRIEF_LOGIN_PASSWORD` in `~/Documents/Code/temida/.env`. Never retry in a loop.
2. **Read.** `brief_data` key `cases` holds every case (facts, grounds, damages scenarios, lawyers, scripts,
   timeline); key `fragments` holds the display prose. `brief_checklist`, `brief_lawyer_status`, `brief_journal`
   and `brief_documents` hold what has actually been done. Read the case named in the argument; with no
   argument, pick the case with the nearest hard deadline and say why.
3. **Write the brief**, in this order, short sentences, no bullet walls:
   - **The case at hand:** parties, what happened, the claim and the forum, in three or four sentences.
   - **Where it stands:** status, the limitation clock (days left, which rule), the live settlement projection
     and what moves it.
   - **Strongest points:** the two or three grounds or facts that carry the case.
   - **Gaps:** evidence that is missing or unconfirmed, checklist items still open, lawyers not yet reached,
     records requests outstanding, anything the timeline asserts without a document behind it.
   - **Next steps:** at most five, ranked by deadline first, then by leverage. Each is one concrete action with
     who to call or what to file, and why now.
   - One line: other cases with a deadline inside 60 days, if any.
   - Close with: "Planning aid, not legal advice. Confirm deadlines with counsel."
4. **Clean up.** `rm <scratchpad>/brief.json`.

## Rules
Use only what the data says. If a date, amount or name is not in the data, call it a gap; never fill it in.
Deadlines are computed from today's date, and say which date you used.
