#!/usr/bin/env bash
# Apply a fixture from fixtures/<NN-name>/ and open a PR.
#
# Flow:
#   1. validate fixture dir + meta.env
#   2. reset working tree to e2e-baseline (refuses if dirty)
#   3. create the fixture branch (force-recreates if it already exists locally)
#   4. copy overlay/ files on top of the baseline working tree
#   5. commit, push, open PR via gh
#
# Fixtures with SKIP_APPLY=true in their meta.env (reusing another PR) and
# MANUAL_ONLY=true (no overlay, no PR) just print instructions and exit.
# Fixtures with PUSH_TO_EXISTING_BRANCH=<branch> push a follow-up commit onto
# an existing fixture branch (no new PR) — used for sequenced two-step
# fixtures like E2E-18b.
set -euo pipefail

usage() {
  cat >&2 <<EOF
usage: $0 <fixture-name>

Examples:
  $0 01-clean-pr
  $0 16-agent-authored

Available fixtures:
$(ls -1 "$(dirname "$0")/../fixtures" 2>/dev/null | sed 's/^/  /')
EOF
  exit 1
}

[ $# -eq 1 ] || usage
NAME="$1"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

FIXTURE_DIR="fixtures/$NAME"
META="$FIXTURE_DIR/meta.env"
OVERLAY="$FIXTURE_DIR/overlay"

if [ ! -d "$FIXTURE_DIR" ]; then
  echo "Fixture not found: $FIXTURE_DIR" >&2
  usage
fi
if [ ! -f "$META" ]; then
  echo "Missing $META" >&2
  exit 1
fi

# --- parse meta.env ---------------------------------------------------------
# Format: KEY=VALUE per line. Values may contain spaces (no quoting required).
# Comments (#) and blank lines are ignored.
BRANCH=""; TITLE=""; BODY=""; DRAFT="false"
SKIP_APPLY="false"; MANUAL_ONLY="false"; REUSES=""; POST_OPEN_HINT=""
PUSH_TO_EXISTING_BRANCH=""; COMMIT_MESSAGE=""; LABELS=""; PREREQ_CHECK=""
while IFS='=' read -r key value; do
  # strip trailing \r in case of CRLF
  value="${value%$'\r'}"
  case "$key" in
    BRANCH) BRANCH="$value" ;;
    TITLE) TITLE="$value" ;;
    BODY) BODY="$value" ;;
    DRAFT) DRAFT="$value" ;;
    SKIP_APPLY) SKIP_APPLY="$value" ;;
    MANUAL_ONLY) MANUAL_ONLY="$value" ;;
    REUSES) REUSES="$value" ;;
    POST_OPEN_HINT) POST_OPEN_HINT="$value" ;;
    PUSH_TO_EXISTING_BRANCH) PUSH_TO_EXISTING_BRANCH="$value" ;;
    COMMIT_MESSAGE) COMMIT_MESSAGE="$value" ;;
    LABELS) LABELS="$value" ;;
    PREREQ_CHECK) PREREQ_CHECK="$value" ;;
    "" | \#*) ;;
  esac
done < <(grep -v '^[[:space:]]*#' "$META" | grep '=')

# --- handle reuse / manual-only fixtures -----------------------------------
if [ "$MANUAL_ONLY" = "true" ]; then
  cat <<EOF
$NAME is a manual fixture (no overlay, no new PR).

$BODY

See $FIXTURE_DIR/README.md for the procedure.
EOF
  exit 0
fi

if [ "$SKIP_APPLY" = "true" ]; then
  cat <<EOF
$NAME reuses an existing PR (${REUSES:-see README}).

$BODY

See $FIXTURE_DIR/README.md for the next step (typically a PR comment or push).
EOF
  exit 0
fi

# --- step-2 fixtures: push another commit onto an existing branch ----------
# Used by sequenced fixtures like E2E-18b that push a follow-up commit to the
# branch opened by their predecessor (E2E-18a). No new branch, no new PR.
if [ -n "$PUSH_TO_EXISTING_BRANCH" ]; then
  if [ ! -d "$OVERLAY" ]; then
    echo "Missing overlay directory: $OVERLAY" >&2
    exit 1
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Working tree has uncommitted changes. Commit or stash before re-running." >&2
    exit 1
  fi
  echo "→ Pushing follow-up commit onto $PUSH_TO_EXISTING_BRANCH."
  git fetch --prune origin --quiet
  if ! git ls-remote --exit-code --heads origin "$PUSH_TO_EXISTING_BRANCH" >/dev/null 2>&1; then
    echo "Remote branch $PUSH_TO_EXISTING_BRANCH does not exist. Apply the step-1 fixture first." >&2
    exit 1
  fi

  # Wait for the step-1 review to COMPLETE before pushing step 2. Without this,
  # both phases land seconds apart and every review grades the cumulative PR
  # diff — i.e. the already-fixed code — so the introduce-phase review the
  # fixture exists to test never happens (mergewatch/mergewatch.ai#375). A fixed
  # sleep is not enough: reviews queue under burst, so poll the check run on the
  # branch's current head. Skip with WAIT_FOR_REVIEW=0 (manual runs where the
  # operator has already verified the first review).
  if [ "${WAIT_FOR_REVIEW:-1}" != "0" ]; then
    NWO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
    STEP1_SHA="$(git ls-remote origin "refs/heads/$PUSH_TO_EXISTING_BRANCH" | cut -f1)"
    WAIT_TIMEOUT="${WAIT_TIMEOUT:-600}"
    WAIT_INTERVAL=10
    waited=0
    echo "→ Waiting for the step-1 review on $STEP1_SHA to complete (timeout ${WAIT_TIMEOUT}s)."
    while :; do
      status="$(gh api "repos/$NWO/commits/$STEP1_SHA/check-runs" \
        --jq '[.check_runs[] | select(.name == "MergeWatch Review")] | first | .status' 2>/dev/null || true)"
      if [ "$status" = "completed" ]; then
        echo "  Step-1 review completed after ${waited}s."
        break
      fi
      if [ "$waited" -ge "$WAIT_TIMEOUT" ]; then
        echo "Step-1 review on $STEP1_SHA still '${status:-absent}' after ${WAIT_TIMEOUT}s." >&2
        echo "Refusing to push step 2 — it would collapse both phases into one diff." >&2
        echo "Re-run once the review lands, or set WAIT_FOR_REVIEW=0 to override." >&2
        exit 1
      fi
      sleep "$WAIT_INTERVAL"
      waited=$((waited + WAIT_INTERVAL))
    done
  fi

  # -B creates-or-resets the local branch to the remote head and checks it out
  # in one step. This works even when that branch is already the current HEAD —
  # which it is when the step-1 fixture (e.g. 18a) ran immediately before in the
  # same suite pass. A plain `branch -D` of the checked-out branch fails with
  # "cannot delete branch ... used by worktree".
  git checkout --quiet -B "$PUSH_TO_EXISTING_BRANCH" "origin/$PUSH_TO_EXISTING_BRANCH"
  echo "→ Applying overlay from $OVERLAY."
  find "$OVERLAY" -type f -print0 | while IFS= read -r -d '' src; do
    rel="${src#$OVERLAY/}"
    dest="$REPO_ROOT/$rel"
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "    + $rel"
  done
  git add -A
  if git diff --cached --quiet; then
    echo "Overlay produced no changes vs. current branch head — nothing to commit." >&2
    exit 1
  fi
  MSG="${COMMIT_MESSAGE:-$TITLE}"
  git commit --quiet -m "$MSG"
  git push --quiet
  PR_NUMBER="$(gh pr view "$PUSH_TO_EXISTING_BRANCH" --json number --jq .number 2>/dev/null || true)"
  echo ""
  echo "✓ Fixture $NAME pushed."
  echo "  Branch: $PUSH_TO_EXISTING_BRANCH"
  if [ -n "$PR_NUMBER" ]; then
    echo "  PR:     https://github.com/$(gh repo view --json nameWithOwner --jq .nameWithOwner)/pull/$PR_NUMBER"
  fi
  echo ""
  echo "Wait ~30-90s for MergeWatch re-review, then verify against:"
  echo "  $FIXTURE_DIR/README.md"
  exit 0
fi

# --- validate prerequisites -------------------------------------------------
if ! git rev-parse e2e-baseline >/dev/null 2>&1; then
  echo "e2e-baseline tag not found. Run scripts/bootstrap.sh first." >&2
  exit 1
fi
if [ -z "$BRANCH" ] || [ -z "$TITLE" ]; then
  echo "meta.env must define BRANCH and TITLE" >&2
  exit 1
fi
if [ ! -d "$OVERLAY" ]; then
  echo "Missing overlay directory: $OVERLAY" >&2
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found on PATH. Install: https://cli.github.com/" >&2
  exit 1
fi

# Refuse to clobber uncommitted local changes.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes. Commit, stash, or run scripts/bootstrap.sh." >&2
  exit 1
fi

# Out-of-band prerequisite gate (e.g. E2E-68's dashboard-side #AGENTS row).
# A failed check exits 3 — a distinct code run-suite.sh records as
# skipped-missing-prereq instead of an apply failure, so /verify-suite never
# grades a missing prerequisite as a product regression (fixtures#469).
if [ -n "$PREREQ_CHECK" ]; then
  echo "→ Checking prerequisite: $PREREQ_CHECK"
  # Word-split into command + args without eval: no metacharacter, pipeline,
  # or command-substitution interpretation of the meta.env-controlled value.
  read -ra PREREQ_CMD <<< "$PREREQ_CHECK"
  if ! (cd "$REPO_ROOT" && "${PREREQ_CMD[@]}"); then
    echo "Prerequisite check failed for $NAME — skipping apply." >&2
    echo "  $PREREQ_CHECK" >&2
    exit 3
  fi
fi

# --- cache overlay before reset --------------------------------------------
# e2e-baseline may predate this fixture (the tag is moved by hand). Checking
# out the tag would otherwise wipe $OVERLAY off the working tree before we
# get a chance to copy it. Stash it in a tmpdir and treat that as the source.
OVERLAY_CACHE="$(mktemp -d)"
trap 'rm -rf "$OVERLAY_CACHE"' EXIT
cp -R "$OVERLAY/." "$OVERLAY_CACHE/"
OVERLAY="$OVERLAY_CACHE"

# --- reset to baseline ------------------------------------------------------
echo "→ Resetting to e2e-baseline."
# Prune stale remote-tracking refs so --force-with-lease doesn't reject a
# push to a branch we previously deleted via gh pr close --delete-branch.
git fetch --prune origin --quiet
# Drop to a detached HEAD first so deleting/recreating the fixture branch is safe.
git checkout --quiet e2e-baseline
git clean -fd >/dev/null

# --- create the branch ------------------------------------------------------
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "→ Local branch $BRANCH exists — deleting before recreate."
  git branch -D "$BRANCH" >/dev/null
fi
echo "→ Creating $BRANCH from e2e-baseline."
git checkout --quiet -b "$BRANCH"

# --- overlay files ----------------------------------------------------------
echo "→ Applying overlay from $OVERLAY."
# Use find -print0 to survive weird filenames (angle brackets, spaces).
find "$OVERLAY" -type f -print0 | while IFS= read -r -d '' src; do
  rel="${src#$OVERLAY/}"
  dest="$REPO_ROOT/$rel"
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "    + $rel"
done

# --- commit + push ----------------------------------------------------------
git add -A
if git diff --cached --quiet; then
  echo "Overlay produced no changes vs. baseline — nothing to commit." >&2
  exit 1
fi
git commit --quiet -m "$TITLE"
echo "→ Pushing $BRANCH."
git push --quiet -u origin "$BRANCH" --force-with-lease

# --- open PR ----------------------------------------------------------------
PR_ARGS=(pr create --title "$TITLE" --body "$BODY" --base main --head "$BRANCH")
if [ "$DRAFT" = "true" ] || [ -n "$LABELS" ]; then
  # LABELS fixtures must have the label on the PR before the review-triggering
  # event fires. Labels can't be attached atomically at creation, so open as a
  # draft (drafts are skipped), label it, then flip ready — ready_for_review is
  # the first trigger the label can influence.
  PR_ARGS+=(--draft)
fi
echo "→ Opening PR."
PR_URL="$(gh "${PR_ARGS[@]}")"

if [ -n "$LABELS" ]; then
  echo "→ Labeling PR ($LABELS) before marking ready."
  gh pr edit "$BRANCH" --add-label "$LABELS"
  if [ "$DRAFT" != "true" ]; then
    gh pr ready "$BRANCH"
  fi
fi

echo ""
echo "✓ Fixture $NAME applied."
echo "  Branch: $BRANCH"
echo "  PR:     $PR_URL"
if [ -n "$POST_OPEN_HINT" ]; then
  echo ""
  echo "  Next step hint: $POST_OPEN_HINT"
fi
echo ""
echo "Wait ~30-90s for MergeWatch, then verify against:"
echo "  $FIXTURE_DIR/README.md"
