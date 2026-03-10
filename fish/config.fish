# === PATH ===
set -g fish_greeting

fish_add_path /opt/homebrew/bin
fish_add_path /opt/homebrew/opt/ruby/bin
fish_add_path $HOME/.rbenv/shims
fish_add_path $HOME/.bun/bin
fish_add_path $HOME/.local/bin
fish_add_path $HOME/bin

# === Environment ===
# API keys loaded from ~/.config/fish/secrets.fish (not tracked)
if test -f ~/.config/fish/secrets.fish
    source ~/.config/fish/secrets.fish
end

# === fnm (Node version manager) ===
fnm env --shell fish | source

# === Starship prompt ===
starship init fish | source

# === Zoxide ===
zoxide init fish | source

# === Atuin ===
atuin init fish | source

# === fzf ===
fzf --fish | source

# === Aliases ===
alias ls "eza --icons"
alias ll "eza -la --icons"
alias la "eza -a --icons"
alias lt "eza --tree --icons"
alias cat "bat"
alias find "fd"
alias claude "CLAUDE_CODE_DISABLE_NONESSENTIAL_NOTIFICATIONS=1 command claude --dangerously-skip-permissions"
alias c "CLAUDE_CODE_DISABLE_NONESSENTIAL_NOTIFICATIONS=1 command claude --dangerously-skip-permissions"

# === Abbreviations ===
abbr -a code "cd ~/Documents/Code"
abbr -a gs "git status"
abbr -a gd "git diff"
abbr -a gp "git push"
abbr -a gl "git log --oneline -20"
abbr -a ga "git add"
abbr -a gc "git commit"

# === OpenClaw ===
alias cvwake "clawvault wake"
alias cvsleep "clawvault sleep"
alias cvcheck "clawvault doctor"
alias code-sync "~/.openclaw/workspace/shortcuts/code-sync"
