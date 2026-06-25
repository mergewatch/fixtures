#!/usr/bin/env bash
# Run the full E2E fixture suite (or a subset) by applying each fixture.
#
# Each fixture is materialized via scripts/apply-fixture.sh, which resets to
# e2e-baseline, branches, overlays, pushes, and opens a PR. SKIP_APPLY /
# MANUAL_ONLY / PUSH_TO_EXISTING_BRANCH fixtures self-handle and just print
# their instructions.
#
# Usage:
#   scripts/run-suite.sh                 # apply every fixture, sorted
#   scripts/run-suite.sh 21-noop-suggestion 22-claim-aware-verify
#
# Env:
#   SLEEP=<seconds>   pause between fixtures so MergeWatch can review (default 0)
#
# This opens a real PR per non-manual fixture. Tear down afterwards with
# scripts/reset-env.sh.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

APPLY="$REPO_ROOT/scripts/apply-fixture.sh"
SLEEP="${SLEEP:-0}"

if [ "$#" -gt 0 ]; then
  FIXTURES=("$@")
else
  mapfile -t FIXTURES < <(ls -1 "$REPO_ROOT/fixtures" | sort)
fi

TOTAL="${#FIXTURES[@]}"
echo "→ Running suite: $TOTAL fixture(s)."

PASS=(); FAIL=()
i=0
for name in "${FIXTURES[@]}"; do
  i=$((i + 1))
  echo ""
  echo "──────────────────────────────────────────────────────────"
  echo "[$i/$TOTAL] $name"
  echo "──────────────────────────────────────────────────────────"
  if "$APPLY" "$name"; then
    PASS+=("$name")
  else
    echo "✗ $name failed (exit $?)" >&2
    FAIL+=("$name")
  fi
  if [ "$SLEEP" != "0" ] && [ "$i" -lt "$TOTAL" ]; then
    echo "→ Sleeping ${SLEEP}s for MergeWatch…"
    sleep "$SLEEP"
  fi
done

echo ""
echo "══════════════════════════════════════════════════════════"
echo "Suite complete: ${#PASS[@]} applied, ${#FAIL[@]} failed."
if [ "${#FAIL[@]}" -gt 0 ]; then
  printf '  ✗ %s\n' "${FAIL[@]}"
  exit 1
fi
echo "All fixtures applied. Verify each against its fixtures/<name>/README.md,"
echo "then tear down with scripts/reset-env.sh."
