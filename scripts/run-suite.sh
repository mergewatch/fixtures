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
#   # Selective runs (#416) — see scripts/select-fixtures.sh
#   scripts/run-suite.sh --tag agents --tag output
#   scripts/run-suite.sh --mode dynamo
#   scripts/run-suite.sh --tag correctness --automated            # runnable
#   scripts/run-suite.sh --tag correctness --automated --graded  # + can fail
#   git -C ../mergewatch.ai diff --name-only main... \
#     | scripts/run-suite.sh --changed-files -
#
# --dry-run prints the selection and exits without opening any PR. Worth doing
# first: a full run is ~98 PRs and real LLM spend.
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

# --- selection (#416) -------------------------------------------------------
# Flags delegate to select-fixtures.sh; bare positional names still work.
SELECT_ARGS=(); POSITIONAL=(); DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tag|--mode|--changed-files) SELECT_ARGS+=("$1" "$2"); shift 2 ;;
    --dry-run)                    DRY_RUN=1; shift ;;
    --automated|--manual|--graded|--ungraded)
                                  SELECT_ARGS+=("$1"); shift ;;
    --explain)                    SELECT_ARGS+=("--explain"); shift ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *)  POSITIONAL+=("$1"); shift ;;
  esac
done

FIXTURES=()
if [ "${#SELECT_ARGS[@]}" -gt 0 ]; then
  if [ "${#POSITIONAL[@]}" -gt 0 ]; then
    echo "Pass either fixture names or selection flags, not both." >&2
    exit 2
  fi
  while IFS= read -r fx; do
    [ -n "$fx" ] && FIXTURES+=("$fx")
  done < <("$REPO_ROOT/scripts/select-fixtures.sh" "${SELECT_ARGS[@]}") || exit $?
  # An empty selection is a real answer ("nothing relevant changed"), not a
  # reason to fall back to the full suite — falling back would quietly turn a
  # docs-only PR into a 98-fixture run.
  if [ "${#FIXTURES[@]}" -eq 0 ]; then
    echo "→ No fixtures match the selection — nothing to run."
    exit 0
  fi
elif [ "${#POSITIONAL[@]}" -gt 0 ]; then
  FIXTURES=("${POSITIONAL[@]}")
else
  # read into an array without mapfile (bash 4+) so this runs on macOS bash 3.2
  while IFS= read -r fx; do
    [ -n "$fx" ] && FIXTURES+=("$fx")
  done < <(ls -1 "$REPO_ROOT/fixtures" | sort)
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "→ Selection (${#FIXTURES[@]} fixture(s)); --dry-run, nothing applied:"
  printf '    %s\n' "${FIXTURES[@]}"
  exit 0
fi

TOTAL="${#FIXTURES[@]}"

# --- preflight: every selected fixture must exist in e2e-baseline -----------
#
# apply-fixture resets the tree to e2e-baseline before overlaying, so a fixture
# whose DIRECTORY was added after the tag was last moved simply is not there —
# and the failure surfaces as a bare "exit 1" plus a listing of the fixtures
# that do exist, which reads like a typo rather than a stale tag.
#
# This bit for real: 98-oversized-diff-skip and 97-marketplace-purchase were
# merged to main but absent from the tag, so the deploy gate's first
# full-coverage run failed on 98 and blocked production. Fail fast, and name
# the actual fix.
if git rev-parse -q --verify e2e-baseline >/dev/null 2>&1; then
  MISSING=()
  for name in "${FIXTURES[@]}"; do
    git cat-file -e "e2e-baseline:fixtures/$name/meta.env" 2>/dev/null || MISSING+=("$name")
  done
  if [ "${#MISSING[@]}" -gt 0 ]; then
    echo "" >&2
    echo "✗ ${#MISSING[@]} selected fixture(s) do not exist in the e2e-baseline tag:" >&2
    printf '    %s\n' "${MISSING[@]}" >&2
    echo "" >&2
    echo "  Fixture branches are cut from e2e-baseline, so a fixture added to main" >&2
    echo "  after the tag last moved cannot be applied. Advance the tag:" >&2
    echo "" >&2
    echo "    git tag -f e2e-baseline main && git push -f origin e2e-baseline" >&2
    echo "" >&2
    echo "  Check it only moves harness files first — 'git diff --stat e2e-baseline main -- src/'" >&2
    echo "  must be EMPTY, or the app under review changes and past runs stop being" >&2
    echo "  comparable." >&2
    exit 2
  fi
fi

# --- preflight: the baseline's workflow files must match origin/main ---------
#
# Same class as the check above — a stale tag — but it fails differently and
# far more expensively: the push is rejected rather than the overlay missing,
# so EVERY fixture dies and the run reads as a product-wide regression rather
# than a stale pointer (mergewatch.ai#509). Checked once here instead of
# discovered 22 times, 45 seconds apart.
"$REPO_ROOT/scripts/check-baseline-drift.sh" || exit $?

# --- preflight: no fixture may already have an open PR on its branch ---------
#
# Third of the same shape. apply-fixture cannot open a second PR for a branch
# that already has one, so the fixture fails — after everything ahead of it in
# the list has already spent real review budget. One `gh pr list` answers it
# for free, before the first PR is opened.
"$REPO_ROOT/scripts/check-branch-collisions.sh" "${FIXTURES[@]}" || exit $?

echo "→ Running suite: $TOTAL fixture(s)."

PASS=(); FAIL=(); PREREQ_SKIPPED=()
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
    rc=$?
    if [ "$rc" -eq 3 ]; then
      # Distinct exit from apply-fixture's PREREQ_CHECK gate — an out-of-band
      # prerequisite (e.g. E2E-68's #AGENTS row) is missing. Honest manifest
      # state so /verify-suite doesn't grade it as a product failure.
      echo "⊘ $name skipped — missing prerequisite." >&2
      PREREQ_SKIPPED+=("$name")
      applied="skipped-missing-prereq"
    else
      echo "✗ $name failed (exit $rc)" >&2
      FAIL+=("$name")
      applied="error"
      # A fixture that dies mid-apply leaves the overlay uncommitted, and
      # apply-fixture.sh refuses to start on a dirty tree — so ONE failure
      # rejects every fixture after it, each still paying the inter-fixture
      # sleep. The gate's first real run failed exactly this way: fixture 1 had
      # no git identity, and fixtures 2-5 reported "Working tree has
      # uncommitted changes". Five failures, one cause, and in a blocking gate
      # that reads as a broad regression rather than a missing config.
      #
      # Restore the tree so each fixture's result reflects that fixture.
      if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain)" ]; then
        echo "→ Restoring a clean tree so the next fixture is not poisoned by this one." >&2
        git reset --hard --quiet 2>/dev/null || true
        git clean -fdq 2>/dev/null || true
      fi
    fi
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
echo "Suite complete: ${#PASS[@]} applied, ${#FAIL[@]} failed, ${#PREREQ_SKIPPED[@]} skipped (missing prereq)."
if [ "${#PREREQ_SKIPPED[@]}" -gt 0 ]; then
  printf '  ⊘ %s\n' "${PREREQ_SKIPPED[@]}"
fi
if [ "${#FAIL[@]}" -gt 0 ]; then
  printf '  ✗ %s\n' "${FAIL[@]}"
  exit 1
fi
echo "All fixtures applied. Grade the run with /verify-suite (reads $MANIFEST),"
echo "then tear down with scripts/reset-env.sh."
