#!/usr/bin/env bash
# Reset the mergewatch-fixtures E2E environment back to a clean baseline.
#
# Full teardown:
#   1. close every open PR (and delete its remote branch via gh)
#   2. delete every remote branch except main
#   3. delete every local branch except main
#   4. return to a clean main reset to the e2e-baseline tag
#   5. prune stale remote-tracking refs
#
# Preserved: the e2e-baseline tag, fixtures/, scripts/, and main.
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
mapfile -t OPEN_PRS < <(gh pr list --state open --limit 200 --json number --jq '.[].number')
if [ "${#OPEN_PRS[@]}" -eq 0 ]; then
  echo "→ No open PRs."
else
  for pr in "${OPEN_PRS[@]}"; do
    echo "→ Closing PR #$pr (deleting branch)."
    gh pr close "$pr" --delete-branch >/dev/null 2>&1 \
      || gh pr close "$pr" >/dev/null   # fall back if branch already gone
  done
fi

# --- 2. delete remaining remote branches except main ------------------------
git fetch --prune origin --quiet
mapfile -t REMOTE_BRANCHES < <(
  git for-each-ref --format='%(refname:short)' refs/remotes/origin \
    | sed 's#^origin/##' \
    | grep -vxE 'main|HEAD'
)
for b in "${REMOTE_BRANCHES[@]}"; do
  [ -z "$b" ] && continue
  echo "→ Deleting remote branch origin/$b."
  git push origin --delete "$b" --quiet 2>/dev/null \
    || echo "    (already gone)"
done

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
mapfile -t LOCAL_BRANCHES < <(git for-each-ref --format='%(refname:short)' refs/heads | grep -vx main)
for b in "${LOCAL_BRANCHES[@]}"; do
  [ -z "$b" ] && continue
  echo "→ Deleting local branch $b."
  git branch -D "$b" >/dev/null
done

# --- 5. final prune ---------------------------------------------------------
git fetch --prune origin --quiet

echo ""
echo "✓ Environment reset."
echo "  Branch:  $(git rev-parse --abbrev-ref HEAD)"
echo "  Head:    $(git rev-parse --short HEAD)"
echo "  Open PRs: $(gh pr list --state open --json number --jq 'length')"
