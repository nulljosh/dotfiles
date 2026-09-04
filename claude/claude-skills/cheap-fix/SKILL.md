---
name: cheap-fix
description: Fix as much of the codebase as possible for free by delegating small, well-scoped chores to a local model (Ollama/llama3.1) instead of doing them yourself, then verify and apply the result. Use when the user wants busywork offloaded to save usage — missing package.json descriptions, version bumps, one-line fixes, boilerplate — across one or many repos. Use when the user says "cheap fix", "bang out", "use llama for this", "delegate to local model", or "/cheap-fix".
---

Delegate mechanical, single-file, zero-judgment edits to a local model running on Ollama, instead of burning your own tokens on typing. You stay the orchestrator: you scope the task, pick the model, verify every result before it touches disk, and you're the one who commits.

## Arguments

Optional: a scope (one repo, a list of repos, or "whole codebase") and a task description. Default: whole `~/Documents/Code`, task inferred from what the user asked.

## Is this task even a fit? (check first, every time)

Only delegate if ALL of these hold:
- Single file, single well-defined change
- You already know the exact fix — you're not asking the model to investigate or decide anything
- Output is easy to verify mechanically (a version string, a description line, a rename, a null check) — not something that needs taste or judgment
- Getting it wrong is cheap to catch (a diff you can eyeball in one line)

If the task needs multi-file reasoning, tracing a bug across the codebase, matching an existing pattern you'd have to go find, or any kind of judgment call — do it yourself. Don't delegate it. The round-trip (write a scoped prompt, call the model, verify the output) costs more than just doing a two-line edit yourself.

## Model selection

Check what's actually installed before picking: `ollama list` and `curl -s localhost:8000/v1/models` (oMLX, if running).

- **Structured/tool-call tasks** (anything opencode or an agent loop needs to call as a function): use a model confirmed to emit real OpenAI-format `tool_calls`, not text pretending to be one. Test first with a dummy tool schema — see Verification below. `llama3.1:8b` on Ollama is confirmed working as of 2026-09-04; Qwen models (both on oMLX and Ollama) were tested and emit broken/text-only tool-call syntax — don't use them for tool-calling paths without re-testing.
- **Plain text generation tasks** (write a description, bump a string, generate a one-liner) that YOU apply via Edit — model doesn't need real tool-calling here, any chat-capable local model works. Qwen-Coder writes better code/text than Llama if you're just taking its text output and applying it yourself.
- Never assume a model's tool-calling works because a config flag says `tool_call: true`. That flag is a claim, not a fact — test it.

## Verification (do this before trusting a model for anything)

```bash
curl -s -m 30 http://localhost:11434/v1/chat/completions -H "Content-Type: application/json" -d '{
"model":"<model>",
"messages":[{"role":"user","content":"list files in current directory"}],
"tools":[{"type":"function","function":{"name":"list_files","description":"list files","parameters":{"type":"object","properties":{"path":{"type":"string"}}}}}],
"max_tokens":50
}'
```
Look for a real `"tool_calls":[...]` array with `"finish_reason":"tool_calls"`. If the tool call shows up as text inside `content` instead (e.g. `<tool_call>` tags, raw JSON dumped in content), that model can't do structured tool-calling — use it for plain-text generation only, or not at all for this task.

## Task catalogue (grown from real runs, 2026-09-04)

Confirmed good fits, cheapest to run first:
- **package.json `description`**: pull the real README intro, have the model write one line from it. Never invent from the name alone.
- **package.json `keywords`**: generate 3-5 from the description you already wrote. Cheap follow-on once descriptions exist.
- **Version bumps**: a plain string edit (`1.0.0` → `1.0.1`), model or not — doesn't even need one, just do it directly.
- **GitHub repo description/topics sync**: mirror what you just wrote into package.json onto the actual GitHub repo page (`gh repo edit --description`). Verify with `gh repo view --json description` after — `gh` edits fail silently in ways that leave stale text.

Checked and already fine, don't bother: alt text on images, debug `console.log`/`debugger` leftovers, GitHub topics (already set fleet-wide as of 2026-09-04).

Ruled out — needs house voice or investigation, not mechanical:
- WHITEPAPER.md, README rewrites, CHANGELOG generation, anything touching prose style
- Bug fixes without a named location, refactors "to match the other apps"

## Known failure modes (models produce plausible-looking wrong output — verify anyway)

- **Regex/sed extraction on single-line minified JSON**: a greedy `sed` pattern grabbing a `"description"` value from a one-line `package.json` will overrun into the next fields. Use a real JSON parser (`python3 -c "import json..."`), never a hand-rolled regex, when reading structured output back out.
- **Stray formatting the model adds unprompted**: markdown code fences (` ```json `) around what should be a bare value, or literal quote marks wrapping a string that's already going inside quotes. Strip before applying, every time — don't assume "return only X" instructions were obeyed.
- **Hallucinated context**: asked for keywords from a plain description with no other context, llama3.1:8b once returned `["game-map", "world-builder", "multiplayer"]` for a finance/markets dashboard app — invented a genre that was never mentioned. It pattern-matched to "everything on one screen" and guessed "game." Spot-check outputs against what you actually know the project to be, not just whether the output is well-formed.
- **Garbled compound words**: same run produced `"swiftnative"` (merged "swift" + "native") for a SwiftUI app's keywords. Small models blend adjacent tokens under length pressure — read every short output word-by-word, don't just skim for shape.

## Workflow

1. **Scope it**: find the real targets with grep/find — don't invent hypothetical ones. E.g. `grep -L '"description"' */package.json` for missing descriptions across repos.
2. **Give the model real context**: pull the actual file/README content, don't ask it to write from nothing.
3. **Call the model** via `curl` to its OpenAI-compatible endpoint (`localhost:11434/v1/chat/completions` for Ollama, `localhost:8000/v1/chat/completions` for oMLX).
4. **Read every output before applying.** Small models produce plausible-looking wrong answers (missing the actual point, hallucinated facts, garbled formatting). Spot-check at least the first couple in a batch by eye; fix or discard bad ones yourself rather than shipping them.
5. **Apply with Edit**, not by piping the model's raw output into a file — you want to see the diff.
6. **Commit and push per-repo** if the user wants it live. Use `git pull --rebase` before push if working across many repos in one session (remotes drift).

## Rules

- Never delegate anything security-, auth-, money-, or data-loss-adjacent, even if it looks mechanical.
- Never apply a model's output blind. You are the verifier, every time.
- One task = one model call per file. Don't batch unrelated files into one prompt — it degrades quality and makes verification harder.
- If a model's output is wrong more than once in a batch, stop delegating that class of task to it and say so — don't push through bad output to finish the batch.
- Report what you delegated vs. did yourself, and why, in one line per item — not a essay.
