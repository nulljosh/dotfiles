---
name: duolingo
description: Scrape Duolingo courses via Chrome and export as Lexly course content, one unit at a time. Also pulls public profile stats (XP, streak, courses) via Duolingo's public API, no browser needed.
---

## Usage

```
/duolingo [course] [unit]
/duolingo profile [username]
```

- `/duolingo` — show status, next unfinished course/unit
- `/duolingo spanish` — start/resume Spanish course
- `/duolingo spanish 1` — jump to Spanish unit 1
- `/duolingo spanish 1 --go` — start the unit (default is to show preview only)
- `/duolingo profile [username]` — print public profile stats (defaults to `nulljosh`): runs `scripts/profile.sh [username]`, which hits `https://www.duolingo.com/2017-06-30/users?username=<name>` directly. No login/Chrome required.
  - **Known gap:** this legacy endpoint's `courses`/`totalXp` only cover language courses. It excludes Math (`MATH_BT`) and Music courses entirely, so the total will undercount vs. the app if the user has XP there. No public API exposes Math/Music XP; would need an authenticated Chrome session to get the true total.
```

## What it does

1. **Read progress** — Load `~/.claude/skills/duolingo/progress.md`, find the first unfinished course/unit.
2. **Open Duolingo** — Chrome to duolingo.com, navigate to the target course.
3. **Complete one unit** — Go lesson by lesson, exercise by exercise, completing all lessons in the unit (no partial units).
4. **Scrape exact content** — For each exercise, capture:
   - **Question/prompt text** (exact wording from Duolingo)
   - **Answer** (the correct choice or typed answer)
   - **All options** (multiple choice answers in original order, if applicable)
   - **Exercise type** (translate, listening, tapping, multiple choice, typing, etc.)
   - **Hints/images** (image URLs or text hints shown in the interface)
   - **Audio/pronunciation hints** if visually indicated
5. **Export as Lexly JSON** — Write to `lexly/content/courses/<course>.json` in the exact shape Duolingo uses (don't simplify or re-abstract; copy the UI directly).
6. **Update catalogs** — Register/update the course in `lexly/content/catalog.json`.
7. **Mark progress** — Check off the unit in `progress.md`, log completion to `lexly/roadmap.md`.
8. **Stop** — Do not auto-advance to the next unit. Wait for user to invoke `/duolingo` again.

## Rules

- **One unit per session** — Never do more than one unit in a single invocation, even if it's quick. Bounded scope prevents token/usage runaway.
- **Exact fidelity** — Copy Duolingo's UI output exactly: question text, option ordering, image URLs, audio cues. Don't simplify, rephrase, or invent. If Duolingo showed it, Lexly gets it as-is.
- **No fabrication** — Only write exercises actually seen/completed. Never invent or re-score an exercise.
- **Resumable** — Always check `progress.md` first. If the user reruns `/duolingo spanish 1` and unit 1 is already `[x]`, offer to skip ahead or show completion summary, don't re-do it.
- **Chrome via claude-in-chrome** — Load tools in one batch (`select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,...`). Avoid dialogs/alerts (they hang the session). If stuck, stop and ask user to manually dismiss.
- **Progress files** — `~/.claude/skills/duolingo/progress.md` is the skill's local queue. `lexly/roadmap.md` is Lexly's project log. Keep both in sync.

## Project Location

- **Skill files:** `~/.claude/skills/duolingo/`
- **Lexly repo:** `~/Documents/Code/lexly`
- **Lexly content schema:** `lexly/content/courses/*.json` (one per course)
- **Lexly catalog:** `lexly/content/catalog.json`

## Implementation

### Phase 1: Bootstrap (first real run, not this scaffold)
User runs `/duolingo` with no args. Script:
1. Checks if `progress.md` exists. If not, create it templated (empty checklist).
2. Navigates to duolingo.com in Chrome.
3. Reads the user's course list from the Duolingo sidebar (e.g., Spanish, French, German, ...).
4. Writes a checklist item `- [ ] spanish` (+ all other courses) into `progress.md`.
5. Reports: "Found N courses, starting with [first]. Run `/duolingo spanish --go` to begin."

### Phase 2: Per-unit execution
User runs `/duolingo spanish --go` (or similar).
1. Load `progress.md`, find Spanish, verify it's not yet all `[x]`.
2. Open duolingo.com, navigate to Spanish course.
3. Identify units (usually listed as "Unit 1: Basics", "Unit 2: ..."). Find first incomplete unit from the course structure.
4. Enter that unit, start first incomplete lesson.
5. **For each exercise in the lesson:**
   - Capture the exercise JSON (question, correct answer, options, type, images, audio cues).
   - Complete it (answer correctly; Duolingo will advance).
6. **After all lessons in the unit are done:**
   - Construct a `unit` object: `{id, title, lessons: [{id, title, exercises: [...]}]}`.
   - Append it to `lexly/content/courses/spanish.json` (create if missing).
   - Update `lexly/content/catalog.json` to include/update the Spanish course entry.
   - Mark the unit done in `progress.md` (e.g., change `- [ ] spanish (unit 1)` to `- [x] spanish (unit 1)`).
   - Append a dated note to `lexly/roadmap.md`: `- [x] Duolingo Spanish unit 1 synced (N exercises)`.
7. Exit. Do not auto-advance.

### Exercise capture format
Every exercise object should preserve:
```json
{
  "id": "<unique-id-or-uuid>",
  "type": "translate|listening|multiple_choice|typing|tapping|pronunciation",
  "question": "<exact-question-text-from-ui>",
  "options": ["option 1", "option 2", ...],  // in original order if multiple choice
  "answer": "<correct-answer-or-index>",
  "hints": {
    "image": "<image-url>",
    "audio": "<audio-hint-text-if-visible>",
    "text": "<any-visible-hint-text>"
  }
}
```

### Automation guardrails
- Load Chrome tools in one `ToolSearch` batch at start of unit.
- Use `read_page` / `get_page_text` to extract text. Avoid screenshotting every exercise.
- If a dialog appears (confirm, alert), stop and ask user to dismiss manually.
- Max 2-3 retries on any single exercise. If stuck, report and stop (don't loop).
- Log every exercise as it's captured (print progress: "Exercise 1/15: Translate 'hello'...").
