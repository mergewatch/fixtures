#!/usr/bin/env bash
# Refuse to start a run whose fixtures cannot open their PRs.
# (mergewatch.ai run 33582978649)
#
# `apply-fixture.sh` opens a PR for a fixture's declared BRANCH. If a PR is
# already open on that branch, the create fails:
#
#   → Pushing claude/fix-greet-bug.
#   → Opening PR.
#   a pull request for branch "claude/fix-greet-bug" into branch "main"
#   already exists: https://github.com/mergewatch/fixtures/pull/1294
#   ✗ 16-agent-authored failed (exit 1)
#
# That fixture then fails, the run fails, and roughly $13 of reviews have
# already been spent on the fixtures ahead of it in the list.
#
# It is not hypothetical and it is not rare: `reset-env.sh` closes only PRs
# whose head branch starts with `fixture/`, scoped that way deliberately after
# fixtures#763 so a teardown could never close a human's work. But an
# agent-detection fixture needs a `claude/` / `cursor/` / `codex/` prefix BY
# DEFINITION — that prefix is the thing under test — so its PR is never torn
# down and it blocks itself on the very next run.
#
# One `gh pr list` and a loop over meta.env answers this before a single PR is
# opened. Cost: zero.
#
# Args: the fixture names about to be applied. With none, checks every fixture.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

command -v gh >/dev/null 2>&1 || { echo "gh CLI not found on PATH." >&2; exit 1; }

FIXTURES=("$@")
if [ "${#FIXTURES[@]}" -eq 0 ]; then
  while IFS= read -r f; do FIXTURES+=("$f"); done < <(ls -1 fixtures)
fi

# One API call. A failure here must not block the run — it would trade a real
# failure mode for a spurious one — so fall through with a warning.
OPEN_BRANCHES="$(gh pr list --state open --limit 200 --json headRefName --jq '.[].headRefName' 2>/dev/null)" || {
  echo "→ Could not list open PRs; skipping the branch-collision preflight." >&2
  exit 0
}

BLOCKED=()
for name in "${FIXTURES[@]}"; do
  meta="fixtures/$name/meta.env"
  [ -f "$meta" ] || continue
  branch="$(grep -E '^BRANCH=' "$meta" | head -1 | cut -d= -f2- | tr -d '\r')"
  [ -n "$branch" ] || continue
  if printf '%s\n' "$OPEN_BRANCHES" | grep -qxF "$branch"; then
    BLOCKED+=("$name -> $branch")
  fi
done

[ "${#BLOCKED[@]}" -eq 0 ] && exit 0

{
  echo ""
  echo "✗ ${#BLOCKED[@]} fixture(s) already have an open PR on their branch:"
  printf '    %s\n' "${BLOCKED[@]}"
  echo ""
  echo "  apply-fixture.sh cannot open a second PR for the same branch, so each of"
  echo "  these would fail — after the fixtures ahead of them had already spent"
  echo "  real review budget."
  echo ""
  echo "  Close them and re-run:"
  echo ""
  echo "    gh pr close <number>"
  echo ""
  echo "  A fixture PR that survives teardown usually means its branch is not"
  echo "  named fixture/*, which is all reset-env.sh closes."
} >&2
exit 2
