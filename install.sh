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

echo "done. secrets files are NOT managed by this repo."
