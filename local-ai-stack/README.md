Claude Code running on a small model on this Mac, through Ollama. Free, offline, nothing leaves the machine. Good for small scripts and one-file fixes, not real app work.

## Use it

```
localclaude
```

Type it in any folder. It starts Ollama if it is not running and builds the model if it is missing. No Anthropic key: the `ollama` token in the function is a placeholder Ollama ignores. `LOCALCLAUDE_MODEL=<tag> localclaude` tries another model.

The function lives in `dotfiles/fish/functions/localclaude.fish`.

## Install from scratch

```
brew install ollama
ollama pull qwen3.5:4b
localclaude
```

The first run builds `qwen3.5-4b-32k` from the `Modelfile` here. It reuses the same download, so it costs no disk.

## Why it is set up this way

Three things had to change before the model would do anything but print code as text.

1. **32k context.** Ollama's default context is too small for Claude Code's tool instructions. They get cut off, and the model never calls a tool. The `Modelfile` raises it to 32768.
2. **`--bare`.** Hooks, memory, CLAUDE.md and the skill list bury a 4B model. With them it copied the style rules and wrote no files. Bare mode drops all of it.
3. **No calling home.** `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` keeps it offline.

Two tweaks made it worse and are left out. `CLAUDE_CODE_MAX_CONTEXT_TOKENS=32768` makes autocompact thrash (205s for the bug fix). `CLAUDE_CODE_DISABLE_THINKING=1` stalled past 6 minutes.

## Tests

Three tasks, each run with `claude --bare -p`, then checked by running the output by hand. All passed on 2026-11-17.

| Task | Time |
|---|---|
| Write FizzBuzz and run it | 145s |
| Fix the bug in a file whose assert fails | 114s |
| Write a function and its test, run the test, fix failures | 62s |
| Same bug fix through `localclaude` itself | 53s |

The model on its own runs at about 28 tokens a second. Raw tool calls through Ollama's API work fine. The slowness is Claude Code's long prompt, not the model.

## Models

`qwen3.5:4b` (3.3 GB) is the default. `qwen3.5:9b` (6.6 GB) is smarter and still fits in 16 GB, at about half the speed. `gpt-oss:20b` and `qwen3-coder:30b` are too big for this Mac.

## Limits

- Auto mode never works on a local model. Its safety classifier runs on Anthropic's servers, and Ollama never forwards to them. Actions fall back to permission prompts. Shift+Tab to another mode.
- The 4B model is too small for reasoning work like debugging config. It is fine for small scripts. Moving to `qwen3.5:9b` needs about 15 GB of free disk first. 9B plus swap on the 16 GB Mac risks a zero-disk crash.

## Aider

`aider-qwen` and `aider-hermes` still exist, but they want `qwen3:8b` and `hermes3`, which are not installed. Pull those first, or use `AIDER_QWEN=qwen3.5:4b aider-qwen`. `benchmarks/hermes-vs-qwen.md` is the old October comparison.
