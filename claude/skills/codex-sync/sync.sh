#!/bin/sh
# Sync Claude Code skills + CLAUDE.md into Codex (skills dir + AGENTS.md).
# Usage: sync.sh [--force]   (--force replaces real AGENTS.md files that drift from CLAUDE.md)
set -e
FORCE=${1:-}
CS=$HOME/.claude/skills; XS=$HOME/.codex/skills
mkdir -p "$XS"

# 1. skills: symlink each Claude skill into Codex (resolve nested symlinks to the real dir)
for d in "$CS"/*/; do
  n=$(basename "$d"); src=$(cd "$d" && pwd -P); dst="$XS/$n"
  if [ -L "$dst" ]; then [ "$(readlink "$dst")" = "$src" ] || { ln -sfn "$src" "$dst"; echo "relink skill $n"; }
  elif [ -e "$dst" ]; then echo "skip skill $n (real dir in codex)"
  else ln -s "$src" "$dst"; echo "link skill $n"; fi
done
# stale links pointing into ~/.claude that no longer resolve
for l in "$XS"/*; do [ -L "$l" ] && [ ! -e "$l" ] && { rm "$l"; echo "prune $(basename "$l")"; }; done

# 2. AGENTS.md -> CLAUDE.md, same dir. Codex global AGENTS.md -> ~/CLAUDE.md.
link_agents() { # $1 = AGENTS.md path, $2 = CLAUDE.md path
  a=$1; c=$2; [ -f "$c" ] || return 0
  if [ -L "$a" ]; then [ "$(readlink "$a")" = "$c" ] || { ln -sfn "$c" "$a"; echo "relink $a"; }
  elif [ -f "$a" ]; then
    if cmp -s "$a" "$c"; then ln -sfn "$c" "$a"; echo "link $a (was identical copy)"
    elif [ "$FORCE" = "--force" ]; then ln -sfn "$c" "$a"; echo "FORCE link $a"
    else echo "DRIFT $a differs from $c (rerun with --force to replace)"; fi
  else ln -s "$c" "$a"; echo "link $a"; fi
}
link_agents "$HOME/AGENTS.md" "$HOME/CLAUDE.md"
link_agents "$HOME/.codex/AGENTS.md" "$HOME/CLAUDE.md"
for c in "$HOME/Documents/Code"/*/CLAUDE.md "$HOME/Documents/Code"/CLAUDE.md; do
  [ -f "$c" ] && link_agents "$(dirname "$c")/AGENTS.md" "$c"
done
echo done
