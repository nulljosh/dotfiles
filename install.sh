#!/usr/bin/env bash
set -euo pipefail

DOTFILES="$(cd "$(dirname "$0")" && pwd)"

link() {
    local src="$1" dst="$2"
    mkdir -p "$(dirname "$dst")"
    if [[ -L "$dst" ]]; then
        rm "$dst"
    elif [[ -e "$dst" ]]; then
        echo "backup: $dst -> $dst.bak"
        mv "$dst" "$dst.bak"
    fi
    ln -s "$src" "$dst"
    echo "linked: $dst -> $src"
}

link "$DOTFILES/fish/config.fish"      "$HOME/.config/fish/config.fish"
link "$DOTFILES/zsh/.zshrc"            "$HOME/.zshrc"
link "$DOTFILES/ghostty/config"        "$HOME/.config/ghostty/config"
link "$DOTFILES/starship/starship.toml" "$HOME/.config/starship.toml"
link "$DOTFILES/starship/starship-terminal.toml" "$HOME/.config/starship-terminal.toml"
link "$DOTFILES/claude/commands"               "$HOME/.claude/commands"
link "$DOTFILES/claude/skills"                 "$HOME/.agents/skills"
link "$DOTFILES/claude/claude-skills"          "$HOME/.claude/skills"
link "$DOTFILES/fish/functions"        "$HOME/.config/fish/functions"
link "$DOTFILES/fish/conf.d"           "$HOME/.config/fish/conf.d"
link "$DOTFILES/git/.gitconfig"        "$HOME/.gitconfig"
link "$DOTFILES/git/ignore"            "$HOME/.config/git/ignore"
link "$DOTFILES/git/hooks"             "$HOME/.git-hooks"
link "$DOTFILES/zsh/.zprofile"         "$HOME/.zprofile"
link "$DOTFILES/zsh/.zshenv"           "$HOME/.zshenv"
link "$DOTFILES/cmux/cmux.json"        "$HOME/.config/cmux/cmux.json"
link "$DOTFILES/claude/settings.json"  "$HOME/.claude/settings.json"
link "$DOTFILES/claude/hooks"          "$HOME/.claude/hooks"
link "$DOTFILES/claude/scripts"        "$HOME/.claude/scripts"
link "$DOTFILES/claude/HOME-CLAUDE.md" "$HOME/CLAUDE.md"

echo "done. secrets files are NOT managed by this repo."
