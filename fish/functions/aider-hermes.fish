function aider-hermes -d "Aider on local Nous Hermes 3 via Ollama (opt-in; Qwen stays the default)"
    OLLAMA_API_BASE=http://127.0.0.1:11434 uvx --python 3.12 --from aider-chat aider --model ollama_chat/hermes3 $argv
end
