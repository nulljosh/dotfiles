---
name: security-sweep
description: Sweep the codebase for security issues, rank by severity (low/medium/high/critical), and patch them. Use when auditing for vulnerabilities, hardcoded secrets, or invoked as /security-sweep.
---

Walk the current project and find security issues, rate each by severity, then patch them. Work lean: grep for patterns first, only read files that match, don't spawn subagents unless the codebase is large enough that a single pass would blow the context budget.

0. Multi-project mode: if invoked from `~/Documents/Code` (or any directory whose immediate subdirectories are themselves separate git repos, rather than the repo itself), run steps 1-5 independently for each subdirectory containing a `.git` (skip non-project folders like `_external`, `node_modules`). Aggregate every project's findings into one combined severity-grouped report (step 5) instead of reporting per project. Do not auto-patch in this mode — multi-project sweeps (including scheduled/unattended runs) are report-only; step 6's patch offer only applies to single-project mode.

1. Identify scope: project root, respecting .gitignore. Exclude node_modules, vendor, build/dist output, lockfiles, and .git.

2. Grep for known risk patterns across the scope: hardcoded secrets/API keys/tokens/passwords, SQL/command/template injection sinks, unsafe deserialization (pickle, yaml.load, eval/exec on input), weak or no crypto (md5, sha1, ECB mode, hardcoded IVs/salts), missing auth/authz checks on routes or handlers, permissive CORS (`*` origins with credentials), unescaped output that enables XSS, insecure direct object references (IDs trusted from request without ownership check), outdated or known-vulnerable dependencies in the package manifest, secrets logged in plaintext, overly permissive file permissions, SSRF-prone outbound requests built from user input.

3. Batch-read the flagged files for context — don't read the whole repo blindly, only files Grep surfaced.

4. Rate each finding with a severity tier and a one-sentence justification:
   - **Critical** — remotely exploitable, leads to RCE, auth bypass, or secret/credential leak on a reachable path.
   - **High** — exploitable given some precondition: injection point, broken authorization, hardcoded prod credentials.
   - **Medium** — weakens defense-in-depth: weak crypto, verbose error leakage, missing rate limiting.
   - **Low** — best-practice gap with limited real-world impact: missing security headers, minor info disclosure.

5. Present findings grouped by severity, critical and high first, as a scannable list: `file:line — issue — severity — why`.

6. Ask once whether to auto-patch. Default: patch critical and high findings immediately with Edit, list medium and low findings for the user to approve individually. After patching, re-grep the affected patterns to confirm they're resolved, then give a final summary: what was patched, what's still open, and why anything was left unpatched (e.g. needs a design decision, not just a code fix).

## Usage awareness
Multi-project mode is the expensive path (15+ repos). If session/weekly usage is high, don't run every subdirectory in one pass: order projects by last-commit recency or ones the user flagged as concerning, sweep those first, and stop once several consecutive projects turn up nothing — note which were skipped rather than silently covering only some. Keep the grep-first, read-only-matches discipline regardless of budget; that's what keeps a single-project sweep cheap already.
