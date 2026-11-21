#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
BIN_DIR="$HOME/.local/bin"
UNINSTALL=0

for arg in "$@"; do
  [[ "$arg" == "--uninstall" ]] && UNINSTALL=1
done

mkdir -p "$BIN_DIR"

# Symlink / remove all bin/* files
while IFS= read -r src; do
  name="$(basename "$src")"
  dest="$BIN_DIR/$name"

  if [[ $UNINSTALL -eq 1 ]]; then
    if [[ -L "$dest" && "$(readlink "$dest")" == "$src" ]]; then
      rm "$dest"
      echo "removed $dest"
    fi
    continue
  fi

  if [[ -L "$dest" && "$(readlink "$dest")" == "$src" ]]; then
    echo "ok     $dest"
  elif [[ -e "$dest" ]]; then
    echo "skip   $dest (exists, not our symlink)"
  else
    ln -s "$src" "$dest"
    echo "linked $dest -> $src"
  fi
done < <(find "$SCRIPT_DIR/bin" -maxdepth 1 \( -type f -o -type l \) | sort)

if [[ $UNINSTALL -eq 1 ]]; then
  echo "uninstall complete"
  exit 0
fi

# Install shell completions
install_completion() {
  local src="$1"
  local dest="$2"
  [[ ! -f "$src" ]] && return
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$dest" ]] && cmp -s "$src" "$dest"; then
    echo "ok     $dest"
  else
    cp "$src" "$dest"
    echo "copied $dest"
  fi
}

# Bash completions
BASH_COMP_DIR="${BASH_COMPLETION_USER_DIR:-$HOME/.local/share/bash-completion/completions}"
install_completion "$SCRIPT_DIR/completions/mac.bash" "$BASH_COMP_DIR/mac"

# Zsh completions
ZSH_COMP_DIR="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/completions"
if [[ ! -d "$ZSH_COMP_DIR" ]]; then
  ZSH_COMP_DIR="$HOME/.local/share/zsh/completions"
fi
install_completion "$SCRIPT_DIR/completions/mac.zsh" "$ZSH_COMP_DIR/_mac"

echo ""
echo "install complete. ensure $BIN_DIR is in your PATH."
