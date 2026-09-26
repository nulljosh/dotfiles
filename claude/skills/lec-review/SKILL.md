---
name: lec-review
description: Go over LEC quiz results. Reads the app's log.jsonl (every quiz submission and tutor reply) from the iCloud School captures folder and summarizes what was submitted per quiz, where Check My Work flagged misses, and what to study. Use when the user says /lec-review, "go over my quiz", or "how did I do".
---
`python3 ~/.Codex/skills/lec-review/review.py` prints each quiz with its submitted answers and any coach notes, newest first. Then explain the misses in plain language, one concept per miss, and suggest what to practice. If the log is empty, say no quiz has been recorded yet.
