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
#
# Writes a run manifest to .e2e/last-run.json mapping each fixture to the PR it
# opened and its apply status (ok/error). /verify-suite reads this to grade the
# run.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

APPLY="$REPO_ROOT/scripts/apply-fixture.sh"
SLEEP="${SLEEP:-0}"
MANIFEST_DIR="$REPO_ROOT/.e2e"
MANIFEST="$MANIFEST_DIR/last-run.json"
mkdir -p "$MANIFEST_DIR"

# Resolve a fixture's BRANCH from meta.env (empty if none).
fixture_branch() {
  local meta="$REPO_ROOT/fixtures/$1/meta.env"
  [ -f "$meta" ] || return 0
  grep -E '^BRANCH=' "$meta" | head -1 | cut -d= -f2- | tr -d '\r'
}

if [ "$#" -gt 0 ]; then
  FIXTURES=("$@")
else
  # read into an array without mapfile (bash 4+) so this runs on macOS bash 3.2
  FIXTURES=()
  while IFS= read -r fx; do
    [ -n "$fx" ] && FIXTURES+=("$fx")
  done < <(ls -1 "$REPO_ROOT/fixtures" | sort)
fi

TOTAL="${#FIXTURES[@]}"
echo "→ Running suite: $TOTAL fixture(s)."

PASS=(); FAIL=()
ENTRIES=()
i=0
for name in "${FIXTURES[@]}"; do
  i=$((i + 1))
  echo ""
  echo "──────────────────────────────────────────────────────────"
  echo "[$i/$TOTAL] $name"
  echo "──────────────────────────────────────────────────────────"
  if "$APPLY" "$name"; then
    PASS+=("$name")
    applied="ok"
  else
    echo "✗ $name failed (exit $?)" >&2
    FAIL+=("$name")
    applied="error"
  fi

  # Resolve the PR this fixture maps to (manual/reuse fixtures may have none).
  # Keep pr strictly numeric-or-null: it's emitted unquoted into JSON, so any
  # stray/non-numeric gh output would otherwise produce an invalid manifest.
  branch="$(fixture_branch "$name")"
  pr="null"
  if [ -n "$branch" ]; then
    num="$(gh pr view "$branch" --json number --jq .number 2>/dev/null || true)"
    [[ "$num" =~ ^[0-9]+$ ]] && pr="$num"
  fi
  ENTRIES+=("$(printf '{"fixture":"%s","branch":"%s","pr":%s,"applied":"%s"}' \
    "$name" "$branch" "$pr" "$applied")")

  if [ "$SLEEP" != "0" ] && [ "$i" -lt "$TOTAL" ]; then
    echo "→ Sleeping ${SLEEP}s for MergeWatch…"
    sleep "$SLEEP"
  fi
done

# --- write manifest ---------------------------------------------------------
NWO="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || echo unknown)"
{
  printf '{"repo":"%s","total":%s,"fixtures":[' "$NWO" "$TOTAL"
  for idx in "${!ENTRIES[@]}"; do
    [ "$idx" -gt 0 ] && printf ','
    printf '%s' "${ENTRIES[$idx]}"
  done
  printf ']}\n'
} > "$MANIFEST"
echo ""
echo "→ Manifest written: $MANIFEST"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "Suite complete: ${#PASS[@]} applied, ${#FAIL[@]} failed."
if [ "${#FAIL[@]}" -gt 0 ]; then
  printf '  ✗ %s\n' "${FAIL[@]}"
  exit 1
fi
echo "All fixtures applied. Grade the run with /verify-suite (reads $MANIFEST),"
echo "then tear down with scripts/reset-env.sh."
