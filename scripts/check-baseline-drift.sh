#!/usr/bin/env bash
# Refuse to start a suite whose fixture pushes are already doomed, or whose
# baseline app no longer matches the one the expectations were written against.
# (mergewatch.ai#509, mergewatch.ai#584)
#
# Two separate staleness checks, both of the form "the e2e-baseline tag has
# fallen behind the commit the run is otherwise driven from".
#
# 1. `.github/workflows/` — fixture branches are cut from `e2e-baseline`, so
#    every push carries whatever workflows that tag holds. A token without
#    `workflow` scope — which is what the E2E gate uses — is rejected the moment
#    those files differ from the default branch:
#
#      ! [remote rejected] fixture/01-clean-pr -> fixture/01-clean-pr
#        (refusing to allow a Personal Access Token to create or update workflow
#         `.github/workflows/release-suite.yml` without `workflow` scope)
#
#    This is not hypothetical and it is not cheap. fixtures#1094 removed two
#    lines from a workflow trigger; four minutes later the next gate run
#    rejected all 22 fixtures, `0 applied`, and blocked production for two
#    commits. The output — 22 red fixtures — reads as a broad product
#    regression, which is the most expensive possible way to say "a tag is
#    stale". Each fixture also paid its 45s inter-fixture sleep to reproduce the
#    identical rejection.
#
# 2. The baseline app itself — `src/` and `.mergewatch.yml`. Since #584,
#    overlays, `meta.env`, and the harness scripts all come from a pinned
#    snapshot of main rather than from the tag; the tag now supplies exactly one
#    thing, the code a fixture branch is cut from. Overlays are WHOLE-FILE
#    copies, so anything in `src/` or `.mergewatch.yml` the overlay does not
#    itself replace is inherited from the tag. If main has moved those files and
#    the tag has not, the run reviews a baseline nobody wrote expectations for —
#    and it does so silently, because every overlay still applies cleanly.
#
#    This is an ALLOWLIST of what a fixture branch carries, not an exclusion
#    list of things known to hurt. An exclusion list would have to be extended
#    every time a new kind of file lands on main, and the day it is not is the
#    day this stops working. `README.md` is deliberately outside it even though
#    fixture 06 overlays it: 06 is docs-only and always skipped, and README
#    edits are the single most common change on main. Every other top-level path
#    an overlay writes (`docs/`, `AGENTS.md`, `CONVENTIONS.md`, `.mergewatch/`,
#    `eslint.config.mjs`, `tsconfig.tsbuildinfo`) exists in neither the tag nor
#    main, so it cannot drift — `check-baseline-drift.test.mjs` asserts that
#    property rather than trusting it.
#
#    There is no escape hatch for this one, on purpose. It blocks the gate, and
#    therefore deploys, until someone re-tags. That is accepted: the alternative
#    is grading the wrong baseline and believing the result. The message says so.
#
# Args:
#   $1  (optional) the commit to compare the tag against — the pinned snapshot
#       SHA run-suite.sh resolved. Without it, `origin/main` is fetched and
#       used, which is the right answer for a standalone local invocation.
#
# Env:
#   ALLOW_WORKFLOW_DRIFT=1   proceed past check 1 anyway. Legitimate: a local
#                            `gh auth` token usually DOES carry `workflow`
#                            scope, so a developer's push can succeed where
#                            CI's cannot. This must not become the standard way
#                            to run. It does NOT open check 2.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# No tag, nothing to drift from — bootstrap.sh has not run yet, and the
# existing preflight in run-suite.sh reports that better than this can.
git rev-parse -q --verify e2e-baseline >/dev/null 2>&1 || exit 0

# --- what the tag is measured against ---------------------------------------
COMPARE_REF="${1:-}"
if [ -n "$COMPARE_REF" ]; then
  # run-suite.sh has already pinned one commit and is driving the whole run
  # from it. Re-resolving `origin/main` here would compare against a DIFFERENT
  # commit than the one being run, so a drift report would name files the run
  # never reads — and worse, a clean report would not mean the run is clean.
  COMPARE="$(git rev-parse -q --verify "${COMPARE_REF}^{commit}")" || {
    echo "✗ check-baseline-drift: cannot resolve comparison ref '$COMPARE_REF'." >&2
    exit 2
  }
  COMPARE_LABEL="$COMPARE_REF"
else
  # Refresh the remote-tracking ref. A stale origin/main is worse than useless
  # here: it would report drift that was already fixed by someone else's re-tag.
  # Best-effort — offline is not a reason to block a run.
  git fetch --quiet origin main 2>/dev/null || true

  # Compare against the remote's main, never the local branch: reset-env.sh moves
  # LOCAL main to the baseline, so `main` and `e2e-baseline` are frequently the
  # same commit on a machine that has just torn a run down. That would make this
  # check silently pass exactly when it matters.
  if ! git rev-parse -q --verify origin/main >/dev/null 2>&1; then
    echo "→ No origin/main to compare against; skipping the baseline drift check." >&2
    exit 0
  fi
  COMPARE="origin/main"
  COMPARE_LABEL="origin/main"
fi

# --- 1. workflow drift ------------------------------------------------------
DRIFT="$(git diff --name-only e2e-baseline "$COMPARE" -- .github/workflows/)"
if [ -n "$DRIFT" ]; then
  if [ "${ALLOW_WORKFLOW_DRIFT:-}" = "1" ]; then
    echo "⚠ e2e-baseline's workflow files differ from $COMPARE_LABEL:" >&2
    printf '    %s\n' $DRIFT >&2
    echo "  ALLOW_WORKFLOW_DRIFT=1 — continuing. Pushes will fail unless your token" >&2
    echo "  has 'workflow' scope." >&2
  else
    {
      echo ""
      echo "✗ e2e-baseline's workflow files have drifted from $COMPARE_LABEL:"
      printf '    %s\n' $DRIFT
      echo ""
      echo "  Every fixture branch is cut from e2e-baseline, so each push carries these"
      echo "  files. A token without 'workflow' scope — including the E2E gate's — is"
      echo "  rejected, and EVERY fixture fails to apply. Stopping now rather than"
      echo "  opening 0 PRs slowly."
      echo ""
      echo "  Advance the tag:"
      echo ""
      echo "    git tag -f e2e-baseline main && git push -f origin e2e-baseline"
      echo ""
      echo "  Check it only moves harness files first — 'git diff --stat e2e-baseline main -- src/'"
      echo "  must be EMPTY, or the app under review changes and past runs stop being"
      echo "  comparable."
      echo ""
      echo "  If your token does carry 'workflow' scope, ALLOW_WORKFLOW_DRIFT=1 skips this."
    } >&2
    exit 2
  fi
fi

# --- 2. baseline-app drift --------------------------------------------------
BASELINE_DRIFT="$(git diff --name-only e2e-baseline "$COMPARE" -- src/ .mergewatch.yml)"
[ -z "$BASELINE_DRIFT" ] && exit 0

{
  echo ""
  echo "✗ The e2e-baseline tag's BASELINE APP has drifted from $COMPARE_LABEL:"
  printf '    %s\n' $BASELINE_DRIFT
  echo ""
  echo "  Fixture branches are cut from e2e-baseline, and overlays are whole-file"
  echo "  copies — so every file above that an overlay does not itself replace comes"
  echo "  from the TAG, while the overlays, meta.env and expect.json all come from"
  echo "  $COMPARE_LABEL. The run would review a baseline the expectations were not"
  echo "  written against, and it would do so silently: every overlay still applies."
  echo ""
  echo "  This blocks the run, and in CI it blocks the deploy, until the tag moves."
  echo "  That is deliberate — grading the wrong baseline and believing the answer is"
  echo "  the more expensive outcome. There is no override."
  echo ""
  echo "  Advance the tag:"
  echo ""
  echo "    git tag -f e2e-baseline main && git push -f origin e2e-baseline"
  echo ""
  echo "  Review the diff above first. A deliberate change to the app under review is"
  echo "  fine — re-tag and expect the fixtures that cover it to need new"
  echo "  expectations. An UNINTENDED one (a fixture overlay leaked onto main, which"
  echo "  is how src/ last changed) should be reverted on main instead."
} >&2
exit 2
