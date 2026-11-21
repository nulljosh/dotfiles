---
name: github-cleanup
description: Shrink GitHub repos and ~/Documents/Code folders toward about 30 each. Deletes dead repos, folds unshipped projects into labs, removes old-name folders. Use for /github-cleanup, "too many repos", "simplify the codebase".
---

# GitHub cleanup

Target: about 30 repos and about 30 folders in `~/Documents/Code`. Stop early if what's left is all shipped (see rule), and report the count. Never merge a shipped app to hit the number.

## Rule (from `~/CLAUDE.md`)

A project keeps its own repo only if it has an App Store record or a live domain. Everything else is a folder in `labs`, or dead. No `-private` twins, no archived repos (delete them), a rename removes the old folder.

## 1. Count

```bash
gh repo list nulljosh --limit 200 --json name,isPrivate,isArchived,isFork,pushedAt,description -q '.[] | [.name,(if .isArchived then "arch" else "" end),(if .isPrivate then "priv" else "pub" end),.pushedAt[:10]] | @tsv' | sort
cd ~/Documents/Code && ls -d */ | wc -l
```

## 2. Classify

| Pattern | Test | Action |
|---|---|---|
| Archived | `isArchived` | delete (check a `CNAME` or live domain first) |
| Private twin | name ends `-private` | delete |
| Superseded rename | old-name repo, same lineage as a live one | delete |
| Unshipped | no ASC id in `~/Documents/Code/CLAUDE.md`, no live `<name>.jaybulb.com` (`curl -sI`) | fold into `labs` as a folder, then delete the repo |
| Old-name folder | symlink (`bookrank`, `scrounge`, `surf`) or dupe of a renamed repo | remove |
| Untracked scratch | gitignored, no remote | move to `_attic` (LaCie symlink), never delete |

Anything else stays. Folders tracked in `labs` are not clutter.

## 3. Act

Before deleting, look at the target (last commit, local folder, unpushed work). Repo deletion is permanent and the auto-mode classifier blocks it, so list the batch to Joshua and get a yes first, then run:

```bash
gh repo delete nulljosh/NAME --yes
```

If a delete is blocked after a yes, hand him the `! gh repo delete ...` line. Don't work around it.

## 4. Report

One line: repo count, folder count, what's left that is all shipped. Update `~/Documents/Code/CLAUDE.md` if a repo it names is gone.
