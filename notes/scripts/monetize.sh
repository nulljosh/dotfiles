#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="."
WRITE_MODE="0"

for arg in "$@"; do
  if [[ "$arg" == "--write" ]]; then
    WRITE_MODE="1"
  elif [[ "$arg" != "" ]]; then
    TARGET_DIR="$arg"
  fi
done

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
PROJECT_NAME="$(basename "$TARGET_DIR")"

detect_stack() {
  local dir="$1"
  local stack=()
  [[ -f "$dir/package.json" ]] && stack+=("Node.js")
  [[ -f "$dir/pyproject.toml" || -f "$dir/requirements.txt" ]] && stack+=("Python")
  [[ -f "$dir/go.mod" ]] && stack+=("Go")
  [[ -f "$dir/Cargo.toml" ]] && stack+=("Rust")
  [[ -f "$dir/ios/Podfile" || -d "$dir/.xcodeproj" || -d "$dir/.xcworkspace" ]] && stack+=("iOS")
  if [[ ${#stack[@]} -eq 0 ]]; then
    echo "Unknown"
  else
    (IFS=", "; echo "${stack[*]}")
  fi
}

infer_model() {
  local dir="$1"
  if [[ -f "$dir/package.json" ]] && rg -qi "auth|login|dashboard|api|saas|billing|subscription" "$dir" -g "README*" -g "*.md" 2>/dev/null; then
    echo "SaaS subscription"
    return
  fi
  if [[ -f "$dir/Cargo.toml" || -f "$dir/go.mod" ]] || rg -qi "cli|library|sdk|tooling" "$dir" -g "README*" -g "*.md" 2>/dev/null; then
    echo "Open-core + paid support"
    return
  fi
  if rg -qi "template|boilerplate|starter" "$dir" -g "README*" -g "*.md" 2>/dev/null; then
    echo "Template sales + support upsell"
    return
  fi
  echo "Services-led productization"
}

STACK="$(detect_stack "$TARGET_DIR")"
MODEL="$(infer_model "$TARGET_DIR")"

REPORT="$(cat <<EOF
# Monetization Plan: ${PROJECT_NAME}

## Snapshot
- Project: ${PROJECT_NAME}
- Path: ${TARGET_DIR}
- Detected stack: ${STACK}
- Recommended model: ${MODEL}

## Pricing Draft
- Starter: \$19/month
- Pro: \$79/month
- Team: \$249/month
- Enterprise: custom annual contract

## Fastest Path to Revenue (30/60/90)
- 30 days: define ICP, publish landing page, add payment flow, run 10 customer interviews.
- 60 days: launch MVP with one paid tier, onboard first 3-5 paying users, instrument retention.
- 90 days: add expansion feature, increase ARPU with Pro/Team upsell, formalize outbound pipeline.

## Execution Checklist
- [ ] Define single core pain solved in one sentence.
- [ ] Package one paid offer (feature, service, or subscription).
- [ ] Add checkout and trial/guarantee terms.
- [ ] Add case-study style examples to README/site.
- [ ] Ship weekly and track activation + retention + conversion.
EOF
)"

if [[ "$WRITE_MODE" == "1" ]]; then
  printf "%s\n" "$REPORT" > "${TARGET_DIR}/MONETIZE.md"
  echo "Wrote ${TARGET_DIR}/MONETIZE.md"
else
  printf "%s\n" "$REPORT"
fi
