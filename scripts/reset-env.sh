#!/usr/bin/env bash
# Reset the mergewatch-fixtures E2E environment back to a clean baseline.
#
# Full teardown:
#   1. close every open `fixture/*` PR (and delete its remote branch via gh)
#   2. delete every remote `fixture/*` branch
#   3. delete every local branch except main
#   4. return to a clean main reset to the e2e-baseline tag
#   5. prune stale remote-tracking refs
#
# Preserved: the e2e-baseline tag, and the `main` BRANCH REF on the remote.
#
# NOT preserved, despite what step 4 sounds like: `git reset --hard e2e-baseline`
# moves the LOCAL main pointer to the baseline commit, so the working tree
# becomes the baseline — and e2e-baseline predates most of the tooling. After
# this script runs, the local tree has no grade-run.mjs, no await-reviews.mjs,
# no select-fixtures.sh, and no fixtures/*/expect.json.
#
# Anything that needs the tooling after a reset must take it from `origin/main`,
# not from `main`. The E2E gate lost two runs to this (mergewatch.ai#451).
#
# This is destructive and runs immediately (no confirmation). Closed PRs and
# deleted branches are gone from the working set; PR history survives on GitHub.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found on PATH. Install: https://cli.github.com/" >&2
  exit 1
fi

NWO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
echo "→ Resetting environment for $NWO"

# --- 1. close all open PRs (deletes their remote branch) --------------------
# Loop instead of a single capped list: a repo can have more open PRs than any
# one --limit, and a teardown that silently leaves some open is a broken reset.
# Each closed PR drops out of the next page, so we converge to zero; the
# zero-progress guard stops us if a PR can't be closed (e.g. permissions).
# Only PRs this harness opened.
#
# This used to close EVERY open PR. That is defensible for a human resetting
# their own environment, and destructive once the E2E gate runs it in CI on a
# shared repo: it closed mergewatch.ai#442's own fixture-authoring PR
# (fixtures#763) mid-review, with --delete-branch, so it could not even be
# reopened without re-pushing the branch. A test harness must not delete work
# it did not create.
#
# `fixture/*` alone was the wrong test for that. An agent-detection fixture
# needs a `claude/` / `cursor/` / `codex/` prefix BY DEFINITION — the prefix is
# the thing under test — so 16-agent-authored was never torn down, and its
# surviving PR then blocked its own next run with "a pull request for branch
# already exists". That cost a full gate run.
#
# The exact test is whether some fixture DECLARES the branch. That covers
# `claude/fix-greet-bug` and still cannot touch a branch no fixture owns, which
# is the #763 guarantee. `fixture/*` is kept as a union term so a fixture whose
# directory is missing from the current tree is still cleaned up.
FIXTURE_BRANCHES="$(grep -hE '^BRANCH=' fixtures/*/meta.env 2>/dev/null | cut -d= -f2- | tr -d '\r' | grep -v '^$' | sort -u)"
echo "→ Closing open PRs on fixture branches."
closed_total=0
while :; do
  # read into an array without mapfile (bash 4+) so this runs on macOS bash 3.2
  OPEN_PRS=()
  while IFS="$(printf '\t')" read -r pr_num br; do
    [ -n "$pr_num" ] || continue
    case "$br" in
      fixture/*) ;;
      *) printf '%s\n' "$FIXTURE_BRANCHES" | grep -qxF "$br" || continue ;;
    esac
    OPEN_PRS+=("$pr_num")
  done < <(gh pr list --state open --limit 100 --json number,headRefName \
             --jq '.[] | "\(.number)\t\(.headRefName)"')
  [ "${#OPEN_PRS[@]}" -eq 0 ] && break
  closed_this_round=0
  for pr in "${OPEN_PRS[@]}"; do
    # gh always returns numeric PR ids; guard anyway so a malformed value never
    # reaches the close call (defense-in-depth, never skips a real PR).
    [[ "$pr" =~ ^[0-9]+$ ]] || { echo "    (skipping non-numeric id: $pr)" >&2; continue; }
    echo "→ Closing PR #$pr (deleting branch)."
    if gh pr close "$pr" --delete-branch >/dev/null 2>&1 \
      || gh pr close "$pr" >/dev/null 2>&1; then   # fall back if branch already gone
      closed_total=$((closed_total + 1))
      closed_this_round=$((closed_this_round + 1))
    else
      echo "    (could not close #$pr)" >&2
    fi
  done
  if [ "$closed_this_round" -eq 0 ]; then
    echo "→ Remaining PRs could not be closed; stopping." >&2
    break
  fi
done
[ "$closed_total" -eq 0 ] && echo "→ No open fixture/* PRs."

# --- 2. delete remaining remote fixture/* branches ---------------------------
# Scoped for the same reason as the PR close above: anything not named
# `fixture/*` belongs to a person, not to a suite run.
git fetch --prune origin --quiet
# while-read over process substitution (no mapfile) keeps the body in the
# current shell and stays bash 3.2 compatible.
while IFS= read -r b; do
  [ -z "$b" ] && continue
  echo "→ Deleting remote branch origin/$b."
  git push origin --delete "$b" --quiet 2>/dev/null \
    || echo "    (already gone)"
done < <(
  git for-each-ref --format='%(refname:short)' refs/remotes/origin \
    | sed 's#^origin/##' \
    | grep -vxE 'main|HEAD' \
    | grep -E '^fixture/'
)

# --- 3. return to main, reset to baseline -----------------------------------
git checkout --quiet main 2>/dev/null || git checkout --quiet -B main
if git rev-parse e2e-baseline >/dev/null 2>&1; then
  echo "→ Resetting main working tree to e2e-baseline."
  git reset --hard e2e-baseline --quiet
  git clean -fd -- ':!fixtures' ':!scripts' >/dev/null
else
  echo "→ e2e-baseline tag not found — leaving main as-is."
fi

# --- 4. delete all local branches except main -------------------------------
while IFS= read -r b; do
  [ -z "$b" ] && continue
  echo "→ Deleting local branch $b."
  git branch -D "$b" >/dev/null
done < <(git for-each-ref --format='%(refname:short)' refs/heads | grep -vx main)

# --- 5. final prune ---------------------------------------------------------
git fetch --prune origin --quiet

echo ""
echo "✓ Environment reset."
echo "  Branch:  $(git rev-parse --abbrev-ref HEAD)"
echo "  Head:    $(git rev-parse --short HEAD)"
echo "  Open PRs: $(gh pr list --state open --json number --jq 'length')"
