# Notes
v1.0.0
## Rules
- Project purpose: Personal notes repo converted from PDF brain dumps and maintained as markdown
- Plain markdown, no frontmatter
- Keep notes concise -- bullet points over paragraphs
- TODOs use `- [ ]` checkbox format
- Completed items use `- [x]` -- prune periodically
- No emojis
## Run
```bash
./scripts/simplify.sh
./scripts/monetize.sh . --write
./scripts/audit.sh .
./scripts/ship.sh .
```
## Key Files
- CLAUDE.md: Project instructions and brain dump
- index.html: Dashboard
- notes/: Markdown content files
- pages/: Styled note routes, including pages/master.html for the master note view
- assets/css/: Shared styles
- assets/js/: Shared scripts and theme toggle
- assets/img/: Visuals
- scripts/simplify.sh: Repo cleanup command
- notes/master.md: All notes consolidated, viewable at pages/master.html
