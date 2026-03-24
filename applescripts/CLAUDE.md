# AppleScripts

v2.0.0

## Rules

- All tools go in bin/, dispatcher is bin/mac
- Tab completions in completions/ (bash + zsh)
- Workflows are plain text files in workflows/
- No emojis

## Run

```bash
mac <tool> <command> [args]
./install.sh              # symlink all tools
macflow run <name>        # run workflow (morning, focus, present, code, wind-down)
```

## Key Files

- bin/mac: Unified dispatcher for all tools.
- bin/: Individual CLI tools.
- completions/: Bash and zsh tab completion scripts.
- workflows/: Plain text workflow definitions.
- install.sh: Installer for symlinking tools to ~/.local/bin.
