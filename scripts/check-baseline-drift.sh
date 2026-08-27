#!/usr/bin/env bash
# Refuse to start a suite whose fixture pushes are already doomed.
# (mergewatch.ai#509)
#
# Fixture branches are cut from the `e2e-baseline` tag, so every push carries
# whatever `.github/workflows/` that tag holds. A token without `workflow`
# scope — which is what the E2E gate uses — is rejected the moment those files
# differ from the default branch:
#
#   ! [remote rejected] fixture/01-clean-pr -> fixture/01-clean-pr
#     (refusing to allow a Personal Access Token to create or update workflow
#      `.github/workflows/release-suite.yml` without `workflow` scope)
#
# This is not hypothetical and it is not cheap. fixtures#1094 removed two lines
# from a workflow trigger; four minutes later the next gate run rejected all 22
# fixtures, `0 applied`, and blocked production for two commits. The output —
# 22 red fixtures — reads as a broad product regression, which is the most
# expensive possible way to say "a tag is stale". Each fixture also paid its
# 45s inter-fixture sleep to reproduce the identical rejection.
#
# So: check once, before anything is pushed, and name the fix.
#
# Env:
#   ALLOW_WORKFLOW_DRIFT=1   proceed anyway. Legitimate: a local `gh auth`
#                            token usually DOES carry `workflow` scope, so a
#                            developer's push can succeed where CI's cannot.
#                            This must not become the standard way to run.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# No tag, nothing to drift from — bootstrap.sh has not run yet, and the
# existing preflight in run-suite.sh reports that better than this can.
git rev-parse -q --verify e2e-baseline >/dev/null 2>&1 || exit 0

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

DRIFT="$(git diff --name-only e2e-baseline origin/main -- .github/workflows/)"
[ -z "$DRIFT" ] && exit 0

if [ "${ALLOW_WORKFLOW_DRIFT:-}" = "1" ]; then
  echo "⚠ e2e-baseline's workflow files differ from origin/main:" >&2
  printf '    %s\n' $DRIFT >&2
  echo "  ALLOW_WORKFLOW_DRIFT=1 — continuing. Pushes will fail unless your token" >&2
  echo "  has 'workflow' scope." >&2
  exit 0
fi

{
  echo ""
  echo "✗ e2e-baseline's workflow files have drifted from origin/main:"
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
