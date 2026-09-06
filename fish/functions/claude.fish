function claude --description 'Claude Code from a stable path so macOS permission grants survive updates'
    # ponytail: cmux disclaims responsibility; TCC keys bare binaries by path; each update = new path = re-prompt
    set -l real (realpath ~/.local/bin/claude)
    set -l stable ~/.local/share/claude/claude-stable
    if not test -f $stable; or not cmp -s $real $stable
        cp -f $real $stable; and chmod +x $stable
    end
    CLAUDE_CODE_DISABLE_NONESSENTIAL_NOTIFICATIONS=1 exec $stable --dangerously-skip-permissions $argv
end
