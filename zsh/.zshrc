# === Claude Code: drop inherited child-session markers (they disable transcript saving) ===
[[ -o interactive ]] && unset CLAUDE_CODE_CHILD_SESSION CLAUDECODE

# === Homebrew (Apple Silicon or Intel) ===
for brew in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  [[ -x $brew ]] && eval "$($brew shellenv)" && break
done

# === PATH ===
export PATH="$HOME/.local/bin:$HOME/bin:$HOME/.bun/bin:$PATH"
[[ -n $HOMEBREW_PREFIX ]] && export PATH="$HOMEBREW_PREFIX/opt/ruby/bin:$PATH"
export PATH="$HOME/.rbenv/shims:$PATH"
export RBENV_SHELL=zsh
export BUN_INSTALL="$HOME/.bun"

# === Secrets (not tracked) ===
[[ -f ~/.config/zsh/secrets.zsh ]] && source ~/.config/zsh/secrets.zsh

# === Completions ===
autoload -Uz compinit
compinit
[[ -s ~/.bun/_bun ]] && source ~/.bun/_bun
[[ -f ~/.openclaw/completions/openclaw.zsh ]] && source ~/.openclaw/completions/openclaw.zsh

# === Tools ===
has() { command -v "$1" >/dev/null; }
has fnm      && eval "$(fnm env --use-on-cd --shell zsh)"
has fzf      && source <(fzf --zsh)
has zoxide   && eval "$(zoxide init zsh)"
has atuin    && eval "$(atuin init zsh)"

# === Aliases ===
if has eza; then
  alias ls="eza --icons"
  alias ll="eza -la --icons"
  alias la="eza -a --icons"
  alias lt="eza --tree --icons"
fi
has bat && alias cat="bat"
has fd  && alias find="fd"
alias code="cd ~/Documents/Code"
alias chat="claude --model haiku"

# Start Claude in ~/Documents/Code when launched from home (home folder trust isn't saved)
claude() { [[ $PWD == $HOME ]] && cd ~/Documents/Code; command claude "$@"; }

# === OpenClaw ===
alias cvwake='clawvault wake'
alias cvsleep='clawvault sleep'
alias cvcheck='clawvault doctor'
alias code-sync="~/.openclaw/workspace/shortcuts/code-sync"

# === Starship prompt ===
if [[ "$TERM_PROGRAM" == "Apple_Terminal" ]]; then
  export STARSHIP_CONFIG="$HOME/.config/starship-terminal.toml"
else
  export STARSHIP_CONFIG="$HOME/.config/starship.toml"
fi
has starship && eval "$(starship init zsh)"
