function bonsai --description 'Run Bonsai 2 from LaCie; chat at localhost:8080'
    set -l launcher /Volumes/LaCie/llm/bonsai-2/start.command
    if not test -x "$launcher"
        echo 'Connect LaCie first. Bonsai is stored on the external drive.' >&2
        return 1
    end
    command "$launcher" $argv
end

function bonsai-cli --description 'Chat with Bonsai 2 in the terminal'
    set -l runner /Volumes/LaCie/llm/bonsai-2/runtime/llama-prism-b10685-7dffb15/llama-cli
    set -l model /Volumes/LaCie/llm/bonsai-2/Ternary-Bonsai-2-27B-PTQ1_0.gguf
    if not test -x "$runner"; or not test -r "$model"
        echo 'Connect LaCie first. Bonsai is stored on the external drive.' >&2
        return 1
    end
    command "$runner" -m "$model" -c 32768 -ngl 99 --reasoning off --reasoning-budget 0 $argv
end
