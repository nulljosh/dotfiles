---
name: asc-workflow
description: Define, validate, run, resume, and audit repo-local multi-step automations with current `asc workflow` and `.asc/workflow.json`, including step outputs and safe release/TestFlight workflows.
---

# asc workflow

Lane-style automation inside the CLI: `asc workflow validate`, `asc workflow list`, `asc workflow run`. Workflows are repo-local automation files that run trusted shell commands, stream step output to stderr, keep stdout as machine-readable JSON.

Verify flags first: `asc workflow --help`, `asc workflow validate --help`, `asc workflow list --help`, `asc workflow run --help`.

## End-to-end flow
```bash
# 1. Author .asc/workflow.json
asc workflow validate                                              # 2. validate structure/references
asc workflow list; asc workflow list --all                         # 3. discover public workflows
asc workflow run --dry-run beta BUILD_ID:123456789 GROUP_ID:abcdef # 4. preview
asc workflow run beta BUILD_ID:123456789 GROUP_ID:abcdef           # 5. execute
asc workflow run release --resume "release-20260312T120000Z-deadbeef"  # 6. resume a recoverable failure (run ID from JSON result)
```
Don't pass extra `KEY:VALUE` params with `--resume` — the saved workflow file, params, and persisted outputs are reused.

## File location and format
- Default `.asc/workflow.json`; override with `asc workflow run --file ./path/to/workflow.json <name>`. JSONC comments supported.
- Top-level hooks: `before_all`, `after_all`, `error`. Workflow keys: `description`, `private`, `env`, `steps`.
- Step forms: string shorthand (`"echo hello"`), `run` shell command, `workflow` sub-workflow call, `name` label, `if` conditional var name, `with` env overrides for workflow-call steps, `outputs` map for JSON stdout extraction from named run steps.

## Outputs
Run steps can declare `outputs`; the command must emit JSON on stdout (`--output json` for `asc` commands). Reference with `${steps.step_name.OUTPUT_NAME}`.
- A step declaring `outputs` needs a reference-safe `name`.
- Outputs are allowed on `run` steps only, not workflow-call steps.
- Output names must be unique across workflows that can execute together in one run graph.
- Persisted outputs are stored in workflow run state — never map secrets into outputs.

## Runtime params
`asc workflow run <name> [KEY:VALUE ...]` supports both separators: `VERSION:2.1.0` or `VERSION=2.1.0`. Repeated keys are last-write-wins. Reference in shell commands via `$VERSION`.

## Env precedence
- Main run: `definition.env < workflow.env < CLI params`
- Sub-workflow with `with`: `sub-workflow env < caller env and params < step with`

## Conditionals
`"if": "VAR_NAME"` on a step. Truthy: `1`, `true`, `yes`, `y`, `on` (case-insensitive). Lookup checks merged workflow env/params first, then process environment.

## Example workflow
```json
{
  "env": { "APP_ID": "123456789", "VERSION": "1.0.0", "GROUP_ID": "" },
  "before_all": "asc auth status",
  "after_all": "echo workflow_done",
  "error": "echo workflow_failed",
  "workflows": {
    "beta": {
      "description": "Resolve the latest build and distribute it to TestFlight",
      "steps": [
        { "name": "resolve_build", "run": "asc builds info --app $APP_ID --latest --platform IOS --output json",
          "outputs": { "BUILD_ID": "$.data.id" } },
        { "name": "list_groups", "run": "asc testflight groups list --app $APP_ID --limit 20 --output json" },
        { "name": "add_build_to_group", "if": "GROUP_ID",
          "run": "asc builds add-groups --build-id ${steps.resolve_build.BUILD_ID} --group $GROUP_ID" }
      ]
    },
    "release": {
      "description": "Validate, stage, and submit an App Store version",
      "steps": [
        { "name": "validate", "run": "asc validate --app $APP_ID --version $VERSION --platform IOS --output json" },
        { "name": "stage", "run": "asc release stage --app $APP_ID --version $VERSION --build $BUILD_ID --metadata-dir ./metadata/version/$VERSION --confirm --output json" },
        { "name": "submit", "if": "SUBMIT_FOR_REVIEW", "run": "asc review submit --app $APP_ID --version $VERSION --build $BUILD_ID --confirm --output json" }
      ]
    },
    "publish-appstore": {
      "description": "High-level upload plus App Store review submission",
      "steps": [
        { "name": "publish", "run": "asc publish appstore --app $APP_ID --ipa ./build/MyApp.ipa --version $VERSION --wait --submit --confirm --output json" }
      ]
    }
  }
}
```

## Useful invocations
```bash
asc workflow validate | jq -e '.valid == true'
asc workflow list --pretty
asc workflow list --all --pretty
asc workflow run --dry-run beta BUILD_ID:123 GROUP_ID:grp_abc
asc workflow run beta BUILD_ID:123 GROUP_ID:grp_abc | jq -e '.status == "ok"'
asc workflow run release BUILD_ID:123 SUBMIT_FOR_REVIEW:true
asc workflow run release --resume "release-20260312T120000Z-deadbeef"
```

## Safety rules
- Treat `.asc/workflow.json` like code — only run trusted workflow files, keep them in version control.
- Never run workflows from untrusted PRs with secrets.
- Validate first, dry-run next, then run. Explicit IDs and `--confirm` for mutating steps.
- Use `asc validate`, `asc release stage`, `asc review submit`, `asc publish appstore` — never removed submission commands.
