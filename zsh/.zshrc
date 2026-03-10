
# === PATH ===
export PATH="$HOME/.local/bin:$HOME/bin:$PATH"
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
export PATH="$HOME/.rbenv/shims:$PATH"
export PATH="/Users/joshua/.bun/bin:$PATH"
export RBENV_SHELL=zsh

# === Environment ===
# API keys loaded from ~/.config/zsh/secrets.zsh (not tracked)
[[ -f ~/.config/zsh/secrets.zsh ]] && source ~/.config/zsh/secrets.zsh

# === fnm (Node version manager) ===
eval "$(fnm env --shell zsh)"
autoload -Uz add-zsh-hook
_fnm_autoload_hook() {
  if [[ -f .node-version || -f .nvmrc || -f package.json ]]; then
    fnm use --silent-if-unchanged
  fi
}
add-zsh-hook chpwd _fnm_autoload_hook
_fnm_autoload_hook

# === Completions ===
autoload -Uz compinit
compinit
source "/Users/joshua/.openclaw/completions/openclaw.zsh"

# === Modern tool aliases ===
alias ls="eza --icons"
alias ll="eza -la --icons"
alias la="eza -a --icons"
alias lt="eza --tree --icons"
alias cat="bat"
alias find="fd"

# === Project shortcuts ===
alias code="cd ~/Documents/Code"

# === OpenClaw ===
alias cvwake='clawvault wake'
alias cvsleep='clawvault sleep'
alias cvcheck='clawvault doctor'
alias fix-openclaw='launchctl bootstrap gui/$UID ~/Library/LaunchAgents/ai.openclaw.gateway.plist 2>/dev/null || openclaw gateway restart; openclaw gateway probe'
alias code-sync="~/.openclaw/workspace/shortcuts/code-sync"
alias setup-remotes="~/.openclaw/workspace/shortcuts/setup-remotes.sh"

# === Startup tasks (background) ===
gh contribs --user nulljosh -W 2>/dev/null

# === fzf ===
source <(fzf --zsh)

# === zoxide ===
eval "$(zoxide init zsh)"

# === Starship prompt ===
eval "$(starship init zsh)"
