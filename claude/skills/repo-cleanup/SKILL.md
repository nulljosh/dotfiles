---
name: repo-cleanup
description: Count GitHub repos and find merge/delete candidates (superseded renames, forks, subset sites, projects duplicated inside labs). Use when the user asks to clean up GitHub, count repos, consolidate/merge repos, or invokes /repo-cleanup.
---

# Repo cleanup

Target: **10-15 repos**. Everything else merges into an existing one or dies.

## 1. Inventory

```bash
gh repo list --limit 200 --json name,isPrivate,isArchived,isFork,pushedAt,primaryLanguage,description \
  | python3 -c "
import json,sys
r=json.load(sys.stdin); print(len(r),'repos')
for x in sorted(r,key=lambda a:a['pushedAt'],reverse=True):
    print(x['pushedAt'][:10],'PRIV' if x['isPrivate'] else 'pub ','FORK' if x['isFork'] else '    ',x['name'].ljust(24),(x['description'] or '')[:60])
"
```

Under 15? Report the count and stop. Don't invent work.

## 2. Classify (only these four patterns are worth acting on)

| Pattern | Test | Action |
|---|---|---|
| **Superseded rename** | two repos, same content lineage, one renamed (see `project_app_renames` memory) | archive the old name |
| **Fork you never touched** | `isFork: true`, no commits by the user | delete — it's a bookmark, use a star |
| **Subset site** | tiny repo whose files are a subset of a bigger one (`gh api repos/OWNER/R/contents --jq '[.[].name]|join(" ")'`) | fold into the parent, archive |
| **Duplicated inside `labs`** | subdir in `labs` also exists as its own repo | compare last-commit dates; delete the stale copy, keep the live one |

Date check for a labs subdir vs its standalone repo:

```bash
gh api repos/OWNER/labs/commits -X GET -f path=SUBDIR --jq '.[0].commit.author.date'
gh api repos/OWNER/SUBDIR/commits --jq '.[0].commit.author.date'
```

Anything that doesn't match a row above: leave it. Shipped apps stay separate repos — one repo per App Store record.

## 3. Act

Confirm the list with the user first, then:

```bash
gh repo archive OWNER/NAME --yes     # superseded / folded
gh repo delete OWNER/NAME --yes      # unmodified forks only
```

Archive beats delete for anything the user wrote. Deleting a repo also kills its issues and Pages site — check for a `CNAME` first.

For a fold: `git subtree add --prefix=NAME <url> main --squash` into the destination repo, push, then archive the source.
