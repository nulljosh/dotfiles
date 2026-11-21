"""Run the same 3 coding prompts through Qwen and Hermes on local Ollama, one model at a time, and write hermes-vs-qwen.md."""
import json, time, urllib.request, pathlib

MODELS = ["qwen3:8b", "hermes3"]
PROMPTS = [
    "Write a Python function that merges overlapping intervals. Include a short docstring and 3 asserts.",
    "This Python code raises IndexError for an empty list. Fix it and explain the bug in one sentence.\n\ndef median(xs):\n    xs = sorted(xs)\n    n = len(xs)\n    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2",
    "Write a bash one-liner that prints the 5 largest files under the current directory, with human-readable sizes.",
]

def ask(model, prompt, last):
    body = {"model": model, "stream": False, "think": False, "keep_alive": 0 if last else "5m",  # unload after its last prompt, 16 GB fits one model
            "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request("http://localhost:11434/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"})
    t = time.time()
    r = json.load(urllib.request.urlopen(req, timeout=900))
    return r["message"]["content"].strip(), time.time() - t, r.get("eval_count", 0) / (r.get("eval_duration", 1) / 1e9)

out = ["# Hermes 3 vs Qwen3 8B", "", "Same three prompts, local Ollama, one model loaded at a time. Each model loads once, so its first prompt includes the cold load from the LaCie.", ""]
answers = {m: [ask(m, p, i == len(PROMPTS) - 1) for i, p in enumerate(PROMPTS)] for m in MODELS}  # one load per model
for i, p in enumerate(PROMPTS):
    out += [f"## Prompt {i + 1}", "", "```", p, "```", ""]
    for m in MODELS:
        text, secs, tps = answers[m][i]
        out += [f"### {m} ({secs:.0f}s, {tps:.1f} tok/s)", "", text, ""]
pathlib.Path(__file__).with_name("hermes-vs-qwen.md").write_text("\n".join(out))
