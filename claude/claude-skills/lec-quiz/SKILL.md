---
name: lec-quiz
description: Work through LEC / D2L Pre-Calculus 12 quizzes in the user's own logged-in Chrome, download every quiz and learning-guide asset to the School iCloud folder as you go, and ingest the captured questions into Lingo (lexly) as course content. Use when the user says /lec-quiz, "LEC quiz", "D2L quiz", "pre-calc quiz", or asks to pull down course content from lecss.registerbc.ca or onlinelearningbc.com.
---

# LEC quiz + content capture

Course: Pre-Calculus 12, LECSS Section 53 (Jeremy Ratcliffe), Sep 14 2026 – Jun 23 2027.
Portals: `lecss.registerbc.ca` (enrollment) and `langleysd35.onlinelearningbc.com` (D2L/WCLN, OU 153403).

## Ground rule: use the user's real Chrome

The 2026-02 attempt at this (95+ Selenium/Playwright bots, `talli/tools/school/POSTMORTEM.md`)
died on D2L's anti-bot: the smart-curriculum iframe never populates in a driven browser.
**Do not write a scraper.** Use `mcp__claude-in-chrome__*` against the user's already-logged-in
Chrome session — a real browser, real profile, no WebDriver flags. That is the whole fix.

Never guess at answers to submit. Read the question, work it, show the reasoning, and let the
user confirm before anything is submitted. Explain every wrong answer.

## Flow

1. `tabs_context_mcp` first. If no D2L tab is open, `tabs_create_mcp` to the course homepage and
   check the user is signed in (Microsoft SSO). If not, ask them to sign in — do not drive the login.
2. Navigate to the unit's Quizzes page. `read_page` / `get_page_text` rather than screenshots
   where the text is readable; screenshot only diagrams and graphs.
3. For each question: capture it, solve it, explain it. Record it (see Capture format).
4. **Download as you go** (this is the point — the portal content disappears between semesters):
   - Every quiz page: save the text to `.../School/math/Raw/unit N/quizzes/<quiz>.md`.
   - Every linked PDF / learning guide / handout: fetch with `curl` if the URL is public, else
     use the browser's download and move it into `.../School/math/Raw/unit N/`.
   - Diagrams: screenshot into the same unit folder.
   - Base: `/Users/joshua/Library/Mobile Documents/com~apple~CloudDocs/Documents/School/math/Raw/unit N/`
   - Skip anything already on disk. Do not re-download.
5. Ingest into Lingo (see below), then commit + push lexly.

## Capture format

Write one file per quiz to `$CLAUDE_JOB_DIR/tmp/` (or `/tmp`) shaped like:

```json
{
  "unit": 3,
  "lesson": "Polynomial Factoring",
  "questions": [
    {"question": "Factor x^2-9", "answer": "(x-3)(x+3)",
     "choices": ["(x-3)(x+3)", "(x-9)(x+1)", "(x-3)^2", "prime"]}
  ]
}
```

`choices` optional — omitted means a free-entry question.

## Ingest into Lingo

```
python3 ~/.claude/skills/lec-quiz/ingest.py <capture.json> [--pack precalc12]
```

Merges into `~/Documents/Code/lexly/content/courses/<pack>.json`: creates the unit/lesson if
missing, dedupes by question text, assigns ids in the existing
`<pack>_u<N>_l<M>_<i>` scheme, types as `mathChoice` when `choices` is present else `math`.
It prints what it added. Then:

```
cd ~/Documents/Code/lexly && git add -A && git commit -m "precalc12: unit N quiz content" && git push
```

The catalog already lists `precalc12` under the School category — no catalog edit needed unless
you add a brand-new subject.

## Notes
- Learning guides in `math/resources/` are the KEY/FILLED versions; prefer those when explaining.
- If D2L blocks something even in the real browser, say so and hand it back. Do not start
  building evasion. That road is documented and closed.
