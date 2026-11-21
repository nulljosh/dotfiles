---
description: Full machine and session doctor run: updates, brew doctor, disk, git sweep, then checkpoint
---

Run the whole doctor run, in order, and report one TLDR at the end.

1. Updates and health (output below, do not rerun):

!`brew update; brew upgrade; brew upgrade --cask; brew cleanup; brew doctor; gem update; npm upgrade -g; claude update; rbenv install -l | tail -1; fnm install --lts; fnm default lts-latest; df -h / | tail -1; softwareupdate -l 2>&1 | tail -5; true`

2. Flag anything from step 1 that needs me: brew doctor warnings, failed upgrades, disk under 6GB free, pending macOS updates.
3. Run the `git-sweep` skill (unpushed or uncommitted work across ~/Documents/Code).
4. Run the `checkpoint` skill.
