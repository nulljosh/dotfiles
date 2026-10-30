# === Claude Code: drop inherited child-session markers (they disable transcript saving) ===
status is-interactive; and set -e CLAUDE_CODE_CHILD_SESSION CLAUDECODE

# === PATH ===
set -g fish_greeting

# Homebrew (Apple Silicon or Intel)
for brew in /opt/homebrew/bin/brew /usr/local/bin/brew
    if test -x $brew
        $brew shellenv fish | source
        break
    end
end
set -q HOMEBREW_PREFIX; and fish_add_path $HOMEBREW_PREFIX/opt/ruby/bin
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
type -q fnm; and fnm env --use-on-cd --shell fish | source

# === Starship prompt ===
if test "$TERM_PROGRAM" = "Apple_Terminal"
    set -gx STARSHIP_CONFIG $HOME/.config/starship-terminal.toml
else
    set -gx STARSHIP_CONFIG $HOME/.config/starship.toml
end
type -q starship; and starship init fish | source

# === Zoxide ===
type -q zoxide; and zoxide init fish | source

# === Atuin ===
type -q atuin; and atuin init fish | source

# === fzf ===
type -q fzf; and fzf --fish | source

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
