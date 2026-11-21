function aider-qwen -d "Aider on local Qwen via Ollama (the default); pass AIDER_QWEN to pick another tag"
    set -q AIDER_QWEN; or set -l AIDER_QWEN qwen3:8b
    OLLAMA_API_BASE=http://127.0.0.1:11434 uvx --python 3.12 --from aider-chat aider --model ollama_chat/$AIDER_QWEN $argv
end
