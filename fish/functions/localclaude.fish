# Claude Code on a local Ollama model. No Anthropic key: "ollama" is a dummy token Ollama ignores.
# Setup and test numbers: dotfiles/local-ai-stack/README.md
function localclaude --description 'Claude Code on local Qwen 3.5 4B via Ollama, offline'
    set -l model qwen3.5-4b-32k
    set -q LOCALCLAUDE_MODEL; and set model $LOCALCLAUDE_MODEL

    # ponytail: start the server on demand, no always-on service
    if not curl -sf -o /dev/null http://localhost:11434
        ollama serve >/dev/null 2>&1 &
        disown
        for i in (seq 20)
            curl -sf -o /dev/null http://localhost:11434; and break
            sleep 0.5
        end
    end
    if not ollama show $model >/dev/null 2>&1
        ollama create $model -f ~/Documents/Code/dotfiles/local-ai-stack/Modelfile; or return 1
    end

    # --bare drops hooks, memory and skills: a 4B model drowns in them and stops calling tools.
    # Don't set CLAUDE_CODE_MAX_CONTEXT_TOKENS=32768: autocompact thrashes and a 2 minute fix takes 3+.
    env ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_API_KEY= \
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
        claude --bare --model $model $argv
end
