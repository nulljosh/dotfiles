function qlaude -d "Claude Code harness running local qwen via Ollama"
    ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_API_KEY= claude --model qwen2.5-coder:14b $argv
end
