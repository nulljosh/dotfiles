function claude --description 'Claude Code from a stable path so macOS permission grants survive updates'
    # ponytail: cmux disclaims responsibility; TCC keys bare binaries by path; each update = new path = re-prompt
    set -l real (realpath ~/.local/bin/claude)
    set -l stable ~/.local/share/claude/claude-stable
    if not test -f $stable; or not cmp -s $real $stable
        # temp + rename: cp over a signed binary in place (esp. one a running session uses) gets it SIGKILLed
        cp -f $real $stable.tmp; and chmod +x $stable.tmp; and mv -f $stable.tmp $stable
    end
    CLAUDE_CODE_DISABLE_NONESSENTIAL_NOTIFICATIONS=1 $stable --dangerously-skip-permissions $argv
end
