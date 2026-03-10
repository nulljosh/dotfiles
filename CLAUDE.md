# dotfiles maintenance

## Rules
- NEVER commit secrets (API keys, tokens). They live in secrets.fish / secrets.zsh.
- Repo copies must match live configs minus secrets (replaced with source lines).
- After editing a live config, copy the sanitized version into the repo.
- install.sh symlinks repo files to their target locations. Update it if new files are added.
- Test changes by sourcing the config in a new shell before committing.
