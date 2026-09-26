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
#   # Pin the fixture definitions to one commit (mergewatch.ai#584)
#   scripts/run-suite.sh --snapshot-ref "$FIXTURES_SHA" 01-clean-pr
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

SLEEP="${SLEEP:-0}"
MANIFEST_DIR="$REPO_ROOT/.e2e"
MANIFEST="$MANIFEST_DIR/last-run.json"
mkdir -p "$MANIFEST_DIR"

SNAP=""
SELECTION_WHY_FILE=""
SNAPSHOT_SHA=""
cleanup() {
  # The snapshot lives outside the repo, so nothing else reclaims it — and a
  # failed run is exactly when it is largest and least expected. Unconditional,
  # and `return 0` so the trap never overwrites the script's exit status.
  [ -n "$SNAP" ] && rm -rf "$SNAP"
  [ -n "$SELECTION_WHY_FILE" ] && rm -f "$SELECTION_WHY_FILE"
  return 0
}
trap cleanup EXIT

# --- selection (#416) -------------------------------------------------------
# Flags delegate to select-fixtures.sh; bare positional names still work.
SELECT_ARGS=(); POSITIONAL=(); DRY_RUN=0; SNAPSHOT_REF=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag|--mode|--changed-files) SELECT_ARGS+=("$1" "$2"); shift 2 ;;
    --snapshot-ref)               SNAPSHOT_REF="$2"; shift 2 ;;
    --dry-run)                    DRY_RUN=1; shift ;;
    --automated|--manual|--graded|--ungraded)
                                  SELECT_ARGS+=("$1"); shift ;;
    --explain)                    SELECT_ARGS+=("--explain"); shift ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *)  POSITIONAL+=("$1"); shift ;;
  esac
done

# --- pin ONE commit, and read every fixture definition from it (#584) --------
#
# The problem this solves is not subtle once you see the ordering. The E2E gate
# runs `reset-env.sh` immediately before this script, and reset-env does
# `git checkout main && git reset --hard e2e-baseline`. `git reset --hard`
# deletes files tracked in the old HEAD but absent from the target, so after it
# the working tree — fixtures/, scripts/, ALL of it — is the e2e-baseline tag's
# content. The `scripts/run-suite.sh` the gate then invokes is the TAG's copy,
# and so is every overlay it applies.
#
# Consequence: a fixture fix merged to main did nothing until somebody moved the
# tag by hand. The overlay applied cleanly, the review ran, and the assertion
# failed exactly as it had before the fix — so the natural reading was "my fix
# was wrong", not "my fix never ran". That misdiagnosis was paid for twice
# (fixtures#2130, fixtures#3721).
#
# It was also HALF broken, which is worse than fully broken: grade-run.mjs reads
# expect.json from origin/main while the overlay came from the tag. Two halves
# of one fixture, from two different commits.
#
# So: resolve exactly one commit, extract the fixture definitions and the helper
# scripts from it into a tmpdir OUTSIDE the repo (nothing in the repo survives
# `git checkout e2e-baseline` + `git clean -fd`), and read everything from there.
# `$REPO_ROOT` keeps its old meaning — the git working tree we branch, commit and
# push in. E2E_CONTENT_ROOT is exported, so apply-fixture.sh, select-fixtures.sh,
# check-branch-collisions.sh and any relative PREREQ_CHECK all inherit it without
# a per-call-site flag.
#
# --snapshot-ref is how CI passes the SHA it checked out, before reset-env.sh
# rewrites the tree. Without it — a local run — origin/main is the right default,
# and it is PINNED to a SHA once rather than re-resolved, so a push landing
# mid-run cannot change what this run means.
if [ -n "$SNAPSHOT_REF" ]; then
  SNAPSHOT_SHA="$(git rev-parse -q --verify "${SNAPSHOT_REF}^{commit}")" || {
    echo "✗ --snapshot-ref '$SNAPSHOT_REF' does not resolve to a commit." >&2
    exit 2
  }
  SNAPSHOT_LABEL="$SNAPSHOT_REF @ $(git rev-parse --short "$SNAPSHOT_SHA")"
else
  git fetch --quiet origin main 2>/dev/null || true
  SNAPSHOT_SHA="$(git rev-parse -q --verify 'origin/main^{commit}')" || SNAPSHOT_SHA=""
  if [ -n "$SNAPSHOT_SHA" ]; then
    SNAPSHOT_LABEL="origin/main @ $(git rev-parse --short "$SNAPSHOT_SHA")"
  else
    # A fresh clone with no remote-tracking ref. HEAD is the only honest answer,
    # and refusing to run at all would be a worse failure than saying which
    # commit was used. Announced, never silent.
    SNAPSHOT_SHA="$(git rev-parse -q --verify 'HEAD^{commit}')" || {
      echo "✗ No origin/main and no HEAD — cannot pin a fixture snapshot." >&2
      exit 2
    }
    SNAPSHOT_LABEL="HEAD @ $(git rev-parse --short "$SNAPSHOT_SHA") (no origin/main)"
  fi
fi

SNAP="$(mktemp -d)"
# `e2e/` is in the archive because select-fixtures.sh reads e2e/impact-map.yml,
# and the selection has to describe the same commit as the fixtures it selects.
# A path missing from the ref is skipped rather than failing the archive: an old
# ref legitimately predates e2e/.
ARCHIVE_PATHS=()
for _p in scripts fixtures e2e; do
  git cat-file -e "$SNAPSHOT_SHA:$_p" 2>/dev/null && ARCHIVE_PATHS+=("$_p")
done
if [ "${#ARCHIVE_PATHS[@]}" -eq 0 ] \
  || ! git archive "$SNAPSHOT_SHA" "${ARCHIVE_PATHS[@]}" | tar -x -C "$SNAP"; then
  echo "✗ Could not extract a fixture snapshot from $SNAPSHOT_LABEL." >&2
  exit 2
fi
if [ ! -d "$SNAP/fixtures" ]; then
  echo "✗ Snapshot $SNAPSHOT_LABEL has no fixtures/ directory — wrong ref?" >&2
  exit 2
fi
export E2E_CONTENT_ROOT="$SNAP"
APPLY="$SNAP/scripts/apply-fixture.sh"
if [ ! -x "$APPLY" ]; then
  echo "✗ Snapshot $SNAPSHOT_LABEL has no executable scripts/apply-fixture.sh." >&2
  exit 2
fi
echo "→ Fixture snapshot: $SNAPSHOT_LABEL"

# Resolve a fixture's BRANCH from meta.env (empty if none). From the snapshot:
# under the reset tree $REPO_ROOT/fixtures/<f>/meta.env is the tag's copy, so a
# BRANCH renamed on main would put the WRONG branch in the manifest and the
# grader would look for a PR that does not exist.
fixture_branch() {
  local meta="$SNAP/fixtures/$1/meta.env"
  [ -f "$meta" ] || return 0
  grep -E '^BRANCH=' "$meta" | head -1 | cut -d= -f2- | tr -d '\r'
}

FIXTURES=()
if [ "${#SELECT_ARGS[@]}" -gt 0 ]; then
  if [ "${#POSITIONAL[@]}" -gt 0 ]; then
    echo "Pass either fixture names or selection flags, not both." >&2
    exit 2
  fi
  # #560 — capture HOW the selection resolved, so a failure on a fixture that
  # was swept in by a blanket rule can be reported differently from one the
  # change specifically implicated. Set BEFORE the selector runs, or the flag
  # never reaches it.
  SELECTION_WHY_FILE="$(mktemp)"
  SELECT_ARGS+=(--why-file "$SELECTION_WHY_FILE")
  while IFS= read -r fx; do
    [ -n "$fx" ] && FIXTURES+=("$fx")
  done < <("$SNAP/scripts/select-fixtures.sh" "${SELECT_ARGS[@]}") || exit $?
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
  done < <(ls -1 "$SNAP/fixtures" | sort)
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "→ Selection (${#FIXTURES[@]} fixture(s)); --dry-run, nothing applied:"
  printf '    %s\n' "${FIXTURES[@]}"
  exit 0
fi

TOTAL="${#FIXTURES[@]}"

# --- preflight: every selected fixture must exist in the snapshot ------------
#
# Until #584 this asked whether the fixture existed in the e2e-baseline TAG,
# because the tree was reset to the tag before overlaying and a fixture added to
# main after the last re-tag simply was not there. That bit for real:
# 98-oversized-diff-skip and 97-marketplace-purchase were merged to main but
# absent from the tag, and the deploy gate's first full-coverage run failed on 98
# and blocked production.
#
# The snapshot removes that failure mode outright — a fixture on main now applies
# whether or not the tag has moved — so the question becomes the ordinary one: is
# this a fixture that exists at the commit we pinned, or a typo? Keeping the old
# tag-based check would now REJECT exactly the fixtures this change exists to
# make runnable.
MISSING=()
for name in "${FIXTURES[@]}"; do
  [ -f "$SNAP/fixtures/$name/meta.env" ] || MISSING+=("$name")
done
if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "" >&2
  echo "✗ ${#MISSING[@]} selected fixture(s) do not exist in $SNAPSHOT_LABEL:" >&2
  printf '    %s\n' "${MISSING[@]}" >&2
  echo "" >&2
  echo "  Either the name is a typo, or the fixture is not merged at that commit." >&2
  echo "  Available in the snapshot:" >&2
  ls -1 "$SNAP/fixtures" | sed 's/^/      /' >&2
  exit 2
fi

# --- preflight: e2e-baseline must not have drifted from the snapshot ---------
#
# Two stale-tag failures the snapshot does NOT fix, because the tag is still what
# a fixture branch is cut from:
#
#   * workflow drift — the push itself is rejected, so EVERY fixture dies and the
#     run reads as a product-wide regression rather than a stale pointer
#     (mergewatch.ai#509). Checked once here instead of discovered 22 times, 45
#     seconds apart.
#   * baseline-app drift — src/ or .mergewatch.yml moved on main but not on the
#     tag, so the run reviews code the expectations were not written against, and
#     it does so silently (mergewatch.ai#584).
#
# Compared against the PINNED sha, not its own fresh `git fetch origin main`: a
# drift report has to describe the commit this run is actually driven from, or a
# clean report does not mean the run is clean.
"$SNAP/scripts/check-baseline-drift.sh" "$SNAPSHOT_SHA" || exit $?

# --- preflight: no fixture may already have an open PR on its branch ---------
#
# Third of the same shape. apply-fixture cannot open a second PR for a branch
# that already has one, so the fixture fails — after everything ahead of it in
# the list has already spent real review budget. One `gh pr list` answers it
# for free, before the first PR is opened.
"$SNAP/scripts/check-branch-collisions.sh" "${FIXTURES[@]}" || exit $?

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
  SELECTION_WHY="$(cat "${SELECTION_WHY_FILE:-/dev/null}" 2>/dev/null || true)"
  # JSON-escape before embedding. `all:unmapped:<path>` carries a real filename
  # from `git diff --name-only`, and a filename may legally contain a double
  # quote or a backslash. Unescaped, that produces a malformed manifest and the
  # grader's JSON.parse throws — killing the ENTIRE grading step, not just this
  # note. Backslash first, or the escapes escape each other; control characters
  # are dropped since they cannot appear meaningfully in a path we would print.
  SELECTION_WHY="${SELECTION_WHY//\\/\\\\}"
  SELECTION_WHY="${SELECTION_WHY//\"/\\\"}"
  SELECTION_WHY="$(printf '%s' "$SELECTION_WHY" | tr -d '\000-\037')"
  # `snapshot` is the contract with grade-run.mjs: it refuses to grade when the
  # commit the expectations came from is not the commit the overlays came from.
  # Before #584 those were routinely different and nothing said so.
  printf '{"repo":"%s","total":%s,"snapshot":"%s","selection":"%s","fixtures":[' \
    "$NWO" "$TOTAL" "$SNAPSHOT_SHA" "${SELECTION_WHY:-unknown}"
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
